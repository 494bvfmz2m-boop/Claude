const express = require('express');
const { GuildSettings, StaffRanks } = require('../../db/repo');
const cache = require('../../bot/cache');
const { getGuildOr404, guildChannelOptions } = require('../lib/getGuild');

const router = express.Router({ mergeParams: true });

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
  res.render('moderation', { guild, settings, options, hierarchy, availableRoles });
}

router.get('/moderation', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  await renderPage(req, res, guild);
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
  res.redirect(`/dashboard/${guild.id}/moderation`);
});

router.post('/moderation/staff-list-channel', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  GuildSettings.setStaffListChannel(guild.id, req.body.channelId || null);
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
  res.redirect(`/dashboard/${guild.id}/moderation`);
});

router.post('/moderation/hierarchy/remove', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const current = StaffRanks.listForGuild(guild.id).sort((a, b) => a.rank - b.rank).map((r) => r.role_id);
  StaffRanks.replaceAll(guild.id, current.filter((id) => id !== req.body.roleId));
  cache.invalidateStaffRanks(guild.id);
  res.redirect(`/dashboard/${guild.id}/moderation`);
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
  res.redirect(`/dashboard/${guild.id}/moderation`);
});

module.exports = router;
