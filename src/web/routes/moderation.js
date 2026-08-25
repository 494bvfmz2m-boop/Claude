const express = require('express');
const client = require('../../bot/client');
const { GuildSettings, StaffRanks, Warnings, ModActions } = require('../../db/repo');
const cache = require('../../bot/cache');
const { logAction, parseDuration, applyWarningThreshold } = require('../../bot/moderation');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');

const router = express.Router({ mergeParams: true });

const DISCORD_ID = /^\d{5,25}$/;
const THRESHOLD_ACTIONS = new Set(['timeout', 'kick', 'ban']);

function hierarchyWithRoleInfo(guild) {
  return StaffRanks.listForGuild(guild.id)
    .sort((a, b) => b.rank - a.rank) // highest first for display
    .map((r) => {
      const role = guild.roles.cache.get(r.role_id);
      return {
        roleId: r.role_id,
        rank: r.rank,
        name: role ? role.name : `Unknown role (${r.role_id})`,
        color: role && role.color !== 0 ? role.hexColor : '#99aab5',
      };
    });
}

async function renderPage(req, res, guild) {
  const settings = GuildSettings.get(guild.id);
  const options = guildChannelOptions(guild);
  const hierarchy = hierarchyWithRoleInfo(guild);
  const hierarchyRoleIds = new Set(hierarchy.map((h) => h.roleId));
  const availableRoles = options.roles.filter((r) => !hierarchyRoleIds.has(r.id));
  const actions = ModActions.listForGuild(guild.id, 50);
  const notice = req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
  res.render('moderation', { guild, settings, options, hierarchy, availableRoles, actions, notice });
}

router.get('/moderation', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  await renderPage(req, res, guild);
});

function redirectWithNotice(res, guildId, ok, text) {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/dashboard/${guildId}/moderation?${qs.toString()}#actions`);
}

router.post('/moderation/swear-filter', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const words = (req.body.words || '')
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter(Boolean);
  GuildSettings.setSwearFilter(guild.id, { enabled: req.body.enabled === 'on', words });
  cache.invalidateSwearFilter(guild.id);
  res.redirect(`/dashboard/${guild.id}/moderation`);
});

router.post('/moderation/staff-list-channel', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setStaffListChannel(guild.id, req.body.channelId || null);
  GuildSettings.setStaffListColor(guild.id, req.body.color || '#5865F2');
  res.redirect(`/dashboard/${guild.id}/moderation`);
});

router.post('/moderation/hierarchy/add', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const current = StaffRanks.listForGuild(guild.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  if (req.body.roleId && !current.includes(req.body.roleId)) {
    current.push(req.body.roleId); // new roles become the highest rank by default
    StaffRanks.replaceAll(guild.id, current);
    cache.invalidateStaffRanks(guild.id);
  }
  res.redirect(`/dashboard/${guild.id}/moderation#hierarchy`);
});

router.post('/moderation/hierarchy/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const current = StaffRanks.listForGuild(guild.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  StaffRanks.replaceAll(guild.id, current.filter((id) => id !== req.body.roleId));
  cache.invalidateStaffRanks(guild.id);
  res.redirect(`/dashboard/${guild.id}/moderation#hierarchy`);
});

router.post('/moderation/hierarchy/move', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const current = StaffRanks.listForGuild(guild.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  const i = current.indexOf(req.body.roleId);
  const swapWith = req.body.direction === 'up' ? i + 1 : i - 1;
  if (i !== -1 && swapWith >= 0 && swapWith < current.length) {
    [current[i], current[swapWith]] = [current[swapWith], current[i]];
    StaffRanks.replaceAll(guild.id, current);
    cache.invalidateStaffRanks(guild.id);
  }
  res.redirect(`/dashboard/${guild.id}/moderation#hierarchy`);
});

router.post('/moderation/thresholds/add', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const count = parseInt(req.body.count, 10);
  const action = req.body.action;
  const duration = (req.body.duration || '').trim();

  if (Number.isInteger(count) && count > 0 && THRESHOLD_ACTIONS.has(action) && (action !== 'timeout' || parseDuration(duration))) {
    const settings = GuildSettings.get(guild.id);
    const rest = settings.warning_thresholds.filter((t) => t.count !== count);
    rest.push({ count, action, duration: action === 'timeout' ? duration : undefined });
    rest.sort((a, b) => a.count - b.count);
    GuildSettings.setWarningThresholds(guild.id, rest);
  }
  res.redirect(`/dashboard/${guild.id}/moderation#thresholds`);
});

router.post('/moderation/thresholds/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const count = parseInt(req.body.count, 10);
  const settings = GuildSettings.get(guild.id);
  GuildSettings.setWarningThresholds(guild.id, settings.warning_thresholds.filter((t) => t.count !== count));
  res.redirect(`/dashboard/${guild.id}/moderation#thresholds`);
});

function moderatorFromSession(req) {
  return { id: req.session.discordUser.id, tag: req.session.discordUser.username };
}

router.post('/moderation/actions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const action = req.body.action;
  const targetId = (req.body.targetId || '').trim();
  const reason = (req.body.reason || '').trim() || null;
  const moderator = moderatorFromSession(req);

  if (!DISCORD_ID.test(targetId)) {
    return redirectWithNotice(res, guild.id, false, "That doesn't look like a valid Discord user ID.");
  }

  try {
    if (action === 'ban') {
      const user = await client.users.fetch(targetId).catch(() => null);
      await guild.members.ban(targetId, { reason: reason || undefined });
      await logAction(guild, { action: '🔨 Member banned', target: user || targetId, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Banned ${user ? user.tag : targetId}.`);
    }

    if (action === 'unban') {
      await guild.members.unban(targetId, reason || undefined);
      await logAction(guild, { action: '✅ Member unbanned', target: targetId, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Unbanned ${targetId}.`);
    }

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
      return redirectWithNotice(res, guild.id, false, "They're not in this server.");
    }

    if (action === 'kick') {
      await targetMember.kick(reason || undefined);
      await logAction(guild, { action: '👢 Member kicked', target: targetMember.user, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Kicked ${targetMember.user.tag}.`);
    }

    if (action === 'timeout') {
      const ms = parseDuration(req.body.duration);
      if (!ms) return redirectWithNotice(res, guild.id, false, 'Duration must look like 10m, 2h, or 1d (max 28d).');
      await targetMember.timeout(ms, reason || undefined);
      await logAction(guild, {
        action: '🔇 Member timed out', target: targetMember.user, moderator, reason, source: 'dashboard',
        extra: [{ name: 'Duration', value: req.body.duration, inline: true }],
      });
      return redirectWithNotice(res, guild.id, true, `Timed out ${targetMember.user.tag} for ${req.body.duration}.`);
    }

    if (action === 'untimeout') {
      await targetMember.timeout(null, reason || undefined);
      await logAction(guild, { action: '🔊 Timeout removed', target: targetMember.user, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Removed timeout for ${targetMember.user.tag}.`);
    }

    if (action === 'warn') {
      if (!reason) return redirectWithNotice(res, guild.id, false, 'A reason is required for warnings.');
      Warnings.add(guild.id, targetId, moderator.id, reason);
      const count = Warnings.listForUser(guild.id, targetId).length;
      await logAction(guild, { action: '⚠️ Member warned', target: targetMember.user, moderator, reason, source: 'dashboard' });
      const autoNote = await applyWarningThreshold(guild, targetMember, moderator, count);
      await targetMember.user.send({ content: `You were warned in **${guild.name}**: ${reason}` }).catch(() => {});
      return redirectWithNotice(res, guild.id, true, `Warned ${targetMember.user.tag} (${count} total)${autoNote ? ` — ${autoNote}` : ''}.`);
    }

    return redirectWithNotice(res, guild.id, false, 'Unknown action.');
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, `Couldn't do that: ${err.message}`);
  }
});

module.exports = router;
