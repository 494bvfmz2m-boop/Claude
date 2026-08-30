const express = require('express');
const client = require('../../bot/client');
const { GuildSettings, StaffRanks, Hierarchies, Warnings, ModActions } = require('../../db/repo');
const cache = require('../../bot/cache');
const { logAction, parseDuration, applyWarningThreshold, canActOn, buildPunishmentEmbed, sendPunishmentDM } = require('../../bot/moderation');
const { canUseAction } = require('../../bot/commandPermissions');
const { renderHierarchyList } = require('../../bot/staffList');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');
const { resolveMember, DISCORD_ID } = require('../lib/resolveMember');
const { requireArea } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(requireArea('moderation'));

const THRESHOLD_ACTIONS = new Set(['mute', 'kick', 'ban']);

// Actual authorization for each of these lives entirely in the Permissions
// page now (bot/commandPermissions.js) -- same allow-list the slash commands
// check, so a role granted "ban" here can ban from either surface, and a
// role NOT granted it can't, regardless of what real Discord permissions
// that role happens to have.
const KNOWN_ACTIONS = new Set(['ban', 'unban', 'kick', 'mute', 'unmute', 'warn']);

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

function ranksWithRoleInfo(guild, hierarchyId) {
  return StaffRanks.listForHierarchy(hierarchyId)
    .sort((a, b) => b.rank - a.rank) // highest first for display
    .map((r) => {
      const role = guild.roles.cache.get(r.role_id);
      return {
        roleId: r.role_id,
        rank: r.rank,
        skipPromote: r.skip_promote,
        name: role ? role.name : `Unknown role (${r.role_id})`,
        color: role && role.color !== 0 ? role.hexColor : '#99aab5',
      };
    });
}

// Every /moderation/hierarchy/:id/* route below is guild-scoped only by
// virtue of this check -- the ID itself carries no guild info, so without
// it a dashboard user could rename, delete, or repost another guild's
// hierarchy just by guessing/incrementing the ID.
function ownHierarchyOr404(res, guild, id) {
  const hierarchy = Hierarchies.get(Number(id));
  if (!hierarchy || hierarchy.guild_id !== guild.id) {
    res.status(404).render('error', { message: "That hierarchy doesn't exist." });
    return null;
  }
  return hierarchy;
}

function notice(req) {
  return req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
}

function redirectWithNotice(res, guildId, ok, text, page = 'actions') {
  const qs = new URLSearchParams({ ok: ok ? '1' : '0', msg: text });
  res.redirect(`/dashboard/${guildId}/moderation/${page}?${qs.toString()}`);
}

// ---------- Overview ----------
router.get('/moderation', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const settings = GuildSettings.get(guild.id);
  const categories = [
    {
      id: 'swear-filter', label: 'Swear filter',
      desc: 'A banned-word list, whole-word matched.',
      status: settings.swear_filter_enabled ? 'Enabled' : 'Off',
    },
    {
      id: 'link-filter', label: 'Link filter',
      desc: 'Block invite links, all links, or neither.',
      status: settings.link_filter_mode === 'off' ? 'Off' : settings.link_filter_mode === 'invites' ? 'Invites only' : 'All links',
    },
    {
      id: 'hierarchy', label: 'Hierarchies',
      desc: 'Named rank ladders (staff, donators, whatever you want) with auto-updating posted lists.',
      status: `${Hierarchies.listForGuild(guild.id).length} hierarchy(s)`,
    },
    {
      id: 'thresholds', label: 'Auto-punishments',
      desc: 'Actions that fire automatically at a warning count.',
      status: `${settings.warning_thresholds.length} set`,
    },
    {
      id: 'actions', label: 'Issue a punishment',
      desc: 'Ban, kick, mute, warn, or unban someone right from the dashboard.',
      status: null,
    },
    {
      id: 'test-dms', label: 'Test punishment DMs',
      desc: 'See exactly how a ban/kick/mute/warn DM looks, sent to your own DMs.',
      status: null,
    },
    {
      id: 'log', label: 'Moderation log',
      desc: 'Every action taken, from Discord or the dashboard.',
      status: null,
    },
    {
      id: 'bulk-roles', label: 'Bulk roles',
      desc: 'Add or remove a role across many members at once.',
      status: null,
    },
  ];
  res.render('moderationOverview', { guild, categories, notice: notice(req) });
});

// ---------- Swear filter ----------
router.get('/moderation/swear-filter', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('moderationSwearFilter', { guild, settings: GuildSettings.get(guild.id), notice: notice(req) });
});

router.post('/moderation/swear-filter', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const words = (req.body.words || '')
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter(Boolean);
  GuildSettings.setSwearFilter(guild.id, { enabled: req.body.enabled === 'on', words });
  cache.invalidateSwearFilter(guild.id);
  res.redirect(`/dashboard/${guild.id}/moderation/swear-filter`);
});

// ---------- Link filter ----------
router.get('/moderation/link-filter', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('moderationLinkFilter', { guild, settings: GuildSettings.get(guild.id), notice: notice(req) });
});

router.post('/moderation/link-filter', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setLinkFilter(guild.id, req.body.mode);
  cache.invalidateLinkFilter(guild.id);
  res.redirect(`/dashboard/${guild.id}/moderation/link-filter`);
});

// ---------- Hierarchies (rank ladders + their auto-updating posted lists) ----------
async function renderHierarchy(req, res, guild) {
  const options = guildChannelOptions(guild);
  const hierarchies = Hierarchies.listForGuild(guild.id).map((h) => {
    const ranks = ranksWithRoleInfo(guild, h.id);
    const rankRoleIds = new Set(ranks.map((r) => r.roleId));
    return { ...h, ranks, availableRoles: options.roles.filter((r) => !rankRoleIds.has(r.id)) };
  });
  res.render('moderationHierarchy', { guild, options, hierarchies, notice: notice(req) });
}

router.get('/moderation/hierarchy', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  await renderHierarchy(req, res, guild);
});

router.post('/moderation/hierarchy/create', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const name = (req.body.name || '').trim().slice(0, 100);
  if (!name) {
    return redirectWithNotice(res, guild.id, false, 'Give the hierarchy a name.', 'hierarchy');
  }
  Hierarchies.create(guild.id, name);
  return redirectWithNotice(res, guild.id, true, `"${name}" created.`, 'hierarchy');
});

router.post('/moderation/hierarchy/:id/rename', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  const name = (req.body.name || '').trim().slice(0, 100);
  if (!name) {
    return redirectWithNotice(res, guild.id, false, 'Give the hierarchy a name.', 'hierarchy');
  }
  Hierarchies.rename(hierarchy.id, name);
  return redirectWithNotice(res, guild.id, true, 'Renamed.', 'hierarchy');
});

router.post('/moderation/hierarchy/:id/delete', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  Hierarchies.remove(hierarchy.id);
  cache.invalidateStaffRanks(hierarchy.id);
  return redirectWithNotice(res, guild.id, true, `"${hierarchy.name}" deleted.`, 'hierarchy');
});

router.post('/moderation/hierarchy/:id/set-primary', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  Hierarchies.setPrimary(guild.id, hierarchy.id);
  return redirectWithNotice(res, guild.id, true, `"${hierarchy.name}" is now the /promote and /demote hierarchy.`, 'hierarchy');
});

router.post('/moderation/hierarchy/:id/only-show-highest', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  Hierarchies.setOnlyShowHighest(hierarchy.id, req.body.enabled === 'on');
  res.redirect(`/dashboard/${guild.id}/moderation/hierarchy`);
});

router.post('/moderation/hierarchy/:id/list-settings', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  Hierarchies.setListChannel(hierarchy.id, req.body.channelId || null);
  Hierarchies.setColor(hierarchy.id, req.body.color || '#a8e6ff');
  res.redirect(`/dashboard/${guild.id}/moderation/hierarchy`);
});

router.post('/moderation/hierarchy/:id/post', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  if (!hierarchy.channel_id) {
    return redirectWithNotice(res, guild.id, false, 'Pick a channel for this list first.', 'hierarchy');
  }
  try {
    await guild.members.fetch();
    await renderHierarchyList(guild, hierarchy);
    return redirectWithNotice(res, guild.id, true, `"${hierarchy.name}" posted/updated.`, 'hierarchy');
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, `Couldn't post it: ${err.message}`, 'hierarchy');
  }
});

router.post('/moderation/hierarchy/:id/add', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  const current = StaffRanks.listForHierarchy(hierarchy.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  // roleId comes in as a single string from one checkbox or an array from
  // several -- either way, whatever's picked gets appended as new highest
  // ranks in the order the roles were checked.
  const toAdd = [].concat(req.body.roleId || []).filter((id) => id && !current.includes(id));
  if (toAdd.length > 0) {
    StaffRanks.replaceAllForHierarchy(hierarchy.id, guild.id, [...current, ...toAdd]);
    cache.invalidateStaffRanks(hierarchy.id);
  }
  res.redirect(`/dashboard/${guild.id}/moderation/hierarchy`);
});

router.post('/moderation/hierarchy/:id/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;
  const current = StaffRanks.listForHierarchy(hierarchy.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  StaffRanks.replaceAllForHierarchy(hierarchy.id, guild.id, current.filter((id) => id !== req.body.roleId));
  cache.invalidateStaffRanks(hierarchy.id);
  res.redirect(`/dashboard/${guild.id}/moderation/hierarchy`);
});

// One save for the whole rank list -- order (drag or the arrow buttons) and
// which ranks are marked as placeholders are both edited client-side only
// (see moderationHierarchy.ejs) and submitted together here in one POST, so
// moving several ranks around or toggling a few placeholders costs one page
// load instead of one per click.
router.post('/moderation/hierarchy/:id/save-ranks', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const hierarchy = ownHierarchyOr404(res, guild, req.params.id);
  if (!hierarchy) return;

  // roleOrder is the list's final DOM order, highest-rank-first (top of the
  // list = top rank), so it gets reversed here before renumbering 1..N.
  // Anything that didn't come through (JS disabled, stale form) keeps its
  // current relative order, tacked on at the bottom, rather than vanishing.
  const existing = StaffRanks.listForHierarchy(hierarchy.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  const existingSet = new Set(existing);
  const submitted = [...new Set([].concat(req.body.roleOrder || []))].filter((id) => existingSet.has(id));
  const missing = existing.filter((id) => !submitted.includes(id));
  // missing goes first: replaceAllForHierarchy assigns rank = array index + 1
  // (ascending), so the front of this array becomes the lowest rank -- i.e.
  // the bottom of the list, matching the comment above.
  const reordered = [...missing, ...submitted.slice().reverse()];
  const skipSet = new Set([].concat(req.body.skipPromote || []).filter((id) => existingSet.has(id)));

  StaffRanks.replaceAllForHierarchy(hierarchy.id, guild.id, reordered);
  reordered.forEach((roleId) => StaffRanks.setSkipPromote(hierarchy.id, roleId, skipSet.has(roleId)));
  cache.invalidateStaffRanks(hierarchy.id);
  res.redirect(`/dashboard/${guild.id}/moderation/hierarchy`);
});

// ---------- Test punishment DMs ----------
router.get('/moderation/test-dms', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('moderationTestDms', { guild, notice: notice(req) });
});

router.post('/moderation/test-dms/send', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const TEST_REASON = 'This is a test — sent from the dashboard, nothing actually happened.';
  const disclaimer = { name: '⚠️ This is a test', value: "Nothing actually happened — just previewing what a real one looks like." };
  const embeds = [
    buildPunishmentEmbed({ action: 'banned', emoji: '🔨', guildName: guild.name, reason: TEST_REASON, extra: [disclaimer] }),
    buildPunishmentEmbed({ action: 'kicked', emoji: '👢', guildName: guild.name, reason: TEST_REASON, extra: [disclaimer] }),
    buildPunishmentEmbed({
      action: 'muted', emoji: '🔇', guildName: guild.name, reason: TEST_REASON,
      extra: [{ name: 'Duration', value: '10m', inline: true }, disclaimer],
    }),
    buildPunishmentEmbed({ action: 'warned', emoji: '⚠️', guildName: guild.name, reason: TEST_REASON, extra: [disclaimer] }),
  ];

  // Sent directly rather than through sendPunishmentDM, which swallows
  // errors by design (a closed-DMs user shouldn't block a real punishment)
  // -- here the whole point is telling the person whether it actually worked.
  try {
    const user = await client.users.fetch(req.session.discordUser.id);
    for (const embed of embeds) {
      await user.send({ embeds: [embed] });
    }
    return redirectWithNotice(res, guild.id, true, `Sent 4 test DMs to ${user.tag} — check your DMs.`, 'test-dms');
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, `Couldn't DM you: ${err.message} — make sure your DMs are open and you share a server with ModSentry.`, 'test-dms');
  }
});

// ---------- Auto-punishments ----------
router.get('/moderation/thresholds', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('moderationThresholds', { guild, settings: GuildSettings.get(guild.id), notice: notice(req) });
});

router.post('/moderation/thresholds/add', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const count = parseInt(req.body.count, 10);
  const action = req.body.action;
  const duration = (req.body.duration || '').trim();

  if (Number.isInteger(count) && count > 0 && THRESHOLD_ACTIONS.has(action) && (action !== 'mute' || parseDuration(duration))) {
    const settings = GuildSettings.get(guild.id);
    const rest = settings.warning_thresholds.filter((t) => t.count !== count);
    rest.push({ count, action, duration: action === 'mute' ? duration : undefined });
    rest.sort((a, b) => a.count - b.count);
    GuildSettings.setWarningThresholds(guild.id, rest);
  }
  res.redirect(`/dashboard/${guild.id}/moderation/thresholds`);
});

router.post('/moderation/thresholds/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const count = parseInt(req.body.count, 10);
  const settings = GuildSettings.get(guild.id);
  GuildSettings.setWarningThresholds(guild.id, settings.warning_thresholds.filter((t) => t.count !== count));
  res.redirect(`/dashboard/${guild.id}/moderation/thresholds`);
});

// ---------- Issue a punishment ----------
function moderatorFromSession(req) {
  return { id: req.session.discordUser.id, tag: req.session.discordUser.username };
}

router.get('/moderation/actions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('moderationActions', { guild, notice: notice(req) });
});

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

  if (!KNOWN_ACTIONS.has(action)) {
    return redirectWithNotice(res, guild.id, false, 'Unknown action.');
  }
  if (!actingMember || !canUseAction(guild, actingMember, action)) {
    return redirectWithNotice(res, guild.id, false, "You don't have permission for that action -- ask an admin to grant it from the Permissions page.");
  }

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
      if (user) await sendPunishmentDM(user, buildPunishmentEmbed({ action: 'banned', emoji: '🔨', guildName: guild.name, reason }));
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
      await sendPunishmentDM(targetMember.user, buildPunishmentEmbed({ action: 'kicked', emoji: '👢', guildName: guild.name, reason }));
      return redirectWithNotice(res, guild.id, true, `Kicked ${targetMember.user.tag}.`);
    }

    if (action === 'mute') {
      const ms = parseDuration(req.body.duration);
      if (!ms) return redirectWithNotice(res, guild.id, false, 'Duration must look like 10m, 2h, or 1d (max 28d).');
      await targetMember.timeout(ms, reason || undefined);
      await logAction(guild, {
        action: '🔇 Member muted', target: targetMember.user, moderator, reason, source: 'dashboard',
        extra: [{ name: 'Duration', value: req.body.duration, inline: true }],
      });
      await sendPunishmentDM(targetMember.user, buildPunishmentEmbed({
        action: 'muted', emoji: '🔇', guildName: guild.name, reason,
        extra: [{ name: 'Duration', value: req.body.duration, inline: true }],
      }));
      return redirectWithNotice(res, guild.id, true, `Muted ${targetMember.user.tag} for ${req.body.duration}.`);
    }

    if (action === 'unmute') {
      await targetMember.timeout(null, reason || undefined);
      await logAction(guild, { action: '🔊 Member unmuted', target: targetMember.user, moderator, reason, source: 'dashboard' });
      return redirectWithNotice(res, guild.id, true, `Unmuted ${targetMember.user.tag}.`);
    }

    if (action === 'warn') {
      if (!reason) return redirectWithNotice(res, guild.id, false, 'A reason is required for warnings.');
      Warnings.add(guild.id, targetMember.id, moderator.id, reason);
      const count = Warnings.listForUser(guild.id, targetMember.id).length;
      await logAction(guild, { action: '⚠️ Member warned', target: targetMember.user, moderator, reason, source: 'dashboard' });
      const autoNote = await applyWarningThreshold(guild, targetMember, moderator, count);
      await sendPunishmentDM(targetMember.user, buildPunishmentEmbed({ action: 'warned', emoji: '⚠️', guildName: guild.name, reason }));
      return redirectWithNotice(res, guild.id, true, `Warned ${targetMember.user.tag} (${count} total)${autoNote ? ` — ${autoNote}` : ''}.`);
    }

    return redirectWithNotice(res, guild.id, false, 'Unknown action.');
  } catch (err) {
    return redirectWithNotice(res, guild.id, false, `Couldn't do that: ${err.message}`);
  }
});

// ---------- Moderation log ----------
const LOG_PAGE_SIZE = 25;

router.get('/moderation/log', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const moderatorId = req.query.moderatorId || '';
  const action = req.query.action || '';

  const rows = ModActions.listFiltered(guild.id, { moderatorId, action, limit: LOG_PAGE_SIZE, offset: (page - 1) * LOG_PAGE_SIZE });
  const hasNext = rows.length > LOG_PAGE_SIZE;
  const actions = rows.slice(0, LOG_PAGE_SIZE);

  res.render('moderationLog', {
    guild, actions, notice: notice(req), page, hasNext,
    moderatorId, action,
    moderators: ModActions.distinctModerators(guild.id),
    actionTypes: ModActions.distinctActions(guild.id),
  });
});

// ---------- Bulk roles ----------
const BULK_PAGE_SIZE = 50;

router.get('/moderation/bulk-roles', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  await guild.members.fetch().catch(() => {});
  const search = (req.query.search || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  let members = [...guild.members.cache.values()].filter((m) => !m.user.bot);
  if (search) {
    members = members.filter((m) => m.user.username.toLowerCase().includes(search) || (m.nickname || '').toLowerCase().includes(search));
  }
  members.sort((a, b) => a.user.username.localeCompare(b.user.username));

  const total = members.length;
  const totalPages = Math.max(1, Math.ceil(total / BULK_PAGE_SIZE));
  const pageMembers = members.slice((page - 1) * BULK_PAGE_SIZE, page * BULK_PAGE_SIZE);

  res.render('moderationBulkRoles', {
    guild, notice: notice(req), search, page, totalPages, total,
    members: pageMembers, roles: guildChannelOptions(guild).roles,
  });
});

router.post('/moderation/bulk-roles/apply', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const roleId = req.body.roleId;
  const mode = req.body.mode === 'remove' ? 'remove' : 'add';
  const memberIds = [].concat(req.body.memberId || []);
  const backTo = `/dashboard/${guild.id}/moderation/bulk-roles?page=${encodeURIComponent(req.body.page || '1')}&search=${encodeURIComponent(req.body.search || '')}`;

  if (!roleId || memberIds.length === 0) {
    return res.redirect(`${backTo}&msg=${encodeURIComponent('Pick a role and at least one member.')}&ok=0`);
  }

  let changed = 0;
  for (const id of memberIds) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (!member) continue;
    try {
      if (mode === 'add') await member.roles.add(roleId);
      else await member.roles.remove(roleId);
      changed++;
    } catch {
      // Missing permissions or the role sits above ModSentry's own -- skip
      // and keep going rather than aborting the whole batch over one member.
    }
  }

  res.redirect(`${backTo}&msg=${encodeURIComponent(`${mode === 'add' ? 'Added' : 'Removed'} the role for ${changed} of ${memberIds.length} member(s).`)}&ok=1`);
});

module.exports = router;
