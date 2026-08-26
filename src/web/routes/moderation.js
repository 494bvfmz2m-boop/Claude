const express = require('express');
const client = require('../../bot/client');
const { GuildSettings, StaffRanks, Warnings, ModActions } = require('../../db/repo');
const cache = require('../../bot/cache');
const { logAction, parseDuration, applyWarningThreshold, canActOn } = require('../../bot/moderation');
const { renderStaffList } = require('../../bot/staffList');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { resolveMember, DISCORD_ID } = require('../lib/resolveMember');

const router = express.Router({ mergeParams: true });

const THRESHOLD_ACTIONS = new Set(['timeout', 'kick', 'ban']);

// Blunts a stolen/leaked dashboard session (or a bug in a script someone
// wrote against it) from mass-banning/kicking a server -- not a substitute
// for keeping DISCORD_TOKEN and session cookies private, just a limit on
// the blast radius if one leaks anyway.
const ACTION_RATE_LIMIT = { windowMs: 60_000, max: 20 };
const actionAttempts = new Map(); // discordUserId -> timestamps[]

function rateLimited(discordUserId) {
  const now = Date.now();
  const recent = (actionAttempts.get(discordUserId) || []).filter((t) => now - t < ACTION_RATE_LIMIT.windowMs);
  if (recent.length >= ACTION_RATE_LIMIT.max) {
    actionAttempts.set(discordUserId, recent);
    return true;
  }
  recent.push(now);
  actionAttempts.set(discordUserId, recent);
  return false;
}

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

function redirectWithNotice(res, guildId, ok, text, anchor = 'actions') {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/dashboard/${guildId}/moderation?${qs.toString()}#${anchor}`);
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
  res.redirect(`/dashboard/${guild.id}/moderation#hierarchy`);
});

router.post('/moderation/staff-list/post', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const settings = GuildSettings.get(guild.id);
  if (!settings.staff_list_channel_id) {
    return redirectWithNotice(res, guild.id, false, 'Pick a channel for the staff list first.', 'hierarchy');
  }
  try {
    await guild.members.fetch();
    await renderStaffList(guild);
    return redirectWithNotice(res, guild.id, true, 'Staff list posted/updated.', 'hierarchy');
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, `Couldn't post the staff list: ${err.message}`, 'hierarchy');
  }
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

router.post('/moderation/hierarchy/reorder', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const current = StaffRanks.listForGuild(guild.id).sort((a, b) => a.rank - b.rank);

  // Sort by whatever rank number each row was given (ties keep their original
  // relative order), then renumber cleanly 1..N -- so typos/duplicates/gaps
  // in what was typed can't corrupt the stored ranks.
  const reordered = current
    .map((r, i) => {
      const typed = parseInt(req.body[`rank_${r.role_id}`], 10);
      return { roleId: r.role_id, sortKey: Number.isInteger(typed) ? typed : r.rank, i };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.i - b.i)
    .map((r) => r.roleId);

  StaffRanks.replaceAll(guild.id, reordered);
  cache.invalidateStaffRanks(guild.id);
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
  const rawTarget = (req.body.targetId || '').trim();
  const reason = (req.body.reason || '').trim() || null;
  const moderator = moderatorFromSession(req);

  if (rateLimited(moderator.id)) {
    return redirectWithNotice(res, guild.id, false, "That's a lot of actions in a short time — slow down and try again in a minute.");
  }

  if (!rawTarget) {
    return redirectWithNotice(res, guild.id, false, 'Enter a Discord user ID or username.');
  }

  // Same rank-hierarchy rule the slash commands enforce, applied here too --
  // otherwise anyone with just Manage Server on the dashboard could punish a
  // higher-ranked or equally-ranked staff member the slash commands would
  // have refused. Fails closed: if we can't even find the dashboard user as
  // a member of this guild, treat them as unauthorized rather than allow it.
  const actingMember = await guild.members.fetch(moderator.id).catch(() => null);

  if (action === 'unban') {
    if (!DISCORD_ID.test(rawTarget)) {
      return redirectWithNotice(res, guild.id, false, "Unban needs their exact Discord user ID -- banned users can't be looked up by username.");
    }
    try {
      await guild.members.unban(rawTarget, reason || undefined);
      await logAction(guild, { action: '✅ Member unbanned', target: rawTarget, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Unbanned ${rawTarget}.`);
    } catch (err) {
      return redirectWithNotice(res, guild.id, false, `Couldn't unban: ${err.message}`);
    }
  }

  try {
    if (action === 'ban') {
      // Banning can target someone no longer in the server, so a raw ID is
      // taken as-is; a username only resolves if they're still a member.
      let targetId = rawTarget;
      let fallbackName = rawTarget;
      if (!DISCORD_ID.test(rawTarget)) {
        const member = await resolveMember(guild, rawTarget);
        if (!member) {
          return redirectWithNotice(res, guild.id, false, `Couldn't find a member named "${rawTarget}". Use their Discord user ID instead (needed to ban someone no longer in the server).`);
        }
        targetId = member.id;
        fallbackName = member.user.tag;
      }
      // Still check hierarchy if they happen to currently be a member --
      // canActOn allows it unconditionally when the target isn't a member,
      // same as the /ban slash command.
      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (!actingMember || !canActOn(guild, actingMember, targetMember)) {
        return redirectWithNotice(res, guild.id, false, "You can't ban someone with an equal or higher role than you.");
      }
      const user = await client.users.fetch(targetId).catch(() => null);
      await guild.members.ban(targetId, { reason: reason || undefined });
      await logAction(guild, { action: '🔨 Member banned', target: user || targetId, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Banned ${user ? user.tag : fallbackName}.`);
    }

    const targetMember = await resolveMember(guild, rawTarget);
    if (!targetMember) {
      return redirectWithNotice(res, guild.id, false, `Couldn't find "${rawTarget}" in this server.`);
    }

    if (!actingMember || !canActOn(guild, actingMember, targetMember)) {
      return redirectWithNotice(res, guild.id, false, "You can't act on someone with an equal or higher role than you.");
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
      Warnings.add(guild.id, targetMember.id, moderator.id, reason);
      const count = Warnings.listForUser(guild.id, targetMember.id).length;
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
