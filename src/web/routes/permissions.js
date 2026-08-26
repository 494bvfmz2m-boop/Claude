const express = require('express');
const { DashboardRoleAccess, CommandPermissions } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { AREAS } = require('../lib/dashboardAccess');
const { ACTIONS } = require('../../bot/commandPermissions');

const router = express.Router({ mergeParams: true });

// Deliberately not gated via requireArea() like the other route groups --
// "permissions" isn't a grantable area, so only the owner or a real
// Manage-Server holder (req.dashboardAccess.level === 'full') can ever reach
// this page. Otherwise a granted role could hand itself (or anyone else)
// more access than the owner intended.
router.use((req, res, next) => {
  if (req.dashboardAccess && req.dashboardAccess.level === 'full') return next();
  return res.status(403).render('error', { message: "Only the server owner or someone with Manage Server can manage dashboard permissions." });
});

function nonEveryoneRoles(guild) {
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id) // skip @everyone -- granting it would hand access to the whole server
    .sort((a, b) => b.position - a.position);
}

function rolesWithGrants(guild) {
  const areaGrants = new Map(DashboardRoleAccess.listForGuild(guild.id).map((g) => [g.roleId, new Set(g.areas)]));
  const actionGrants = new Map();
  CommandPermissions.listForGuild(guild.id).forEach(({ roleId, action }) => {
    if (!actionGrants.has(roleId)) actionGrants.set(roleId, new Set());
    actionGrants.get(roleId).add(action);
  });

  return nonEveryoneRoles(guild).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color !== 0 ? r.hexColor : '#99aab5',
    areas: areaGrants.get(r.id) || new Set(),
    actions: actionGrants.get(r.id) || new Set(),
  }));
}

router.get('/permissions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('permissions', { guild, roles: rolesWithGrants(guild), areas: AREAS, moderationActions: ACTIONS });
});

router.post('/permissions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  const roles = nonEveryoneRoles(guild);

  // One checkbox per role/area (name="area_<key>[]", value=roleId) and per
  // role/action (name="action_<key>[]", value=roleId) -- matches the grid
  // layout, a row per role with a column per area/action.
  const areaGrants = roles
    .map((r) => ({
      roleId: r.id,
      areas: AREAS.map((a) => a.key).filter((key) => [].concat(req.body[`area_${key}`] || []).includes(r.id)),
    }))
    .filter((g) => g.areas.length > 0);

  const actionGrants = roles
    .map((r) => ({
      roleId: r.id,
      actions: ACTIONS.map((a) => a.key).filter((key) => [].concat(req.body[`action_${key}`] || []).includes(r.id)),
    }))
    .filter((g) => g.actions.length > 0);

  DashboardRoleAccess.replaceAll(guild.id, areaGrants);
  CommandPermissions.replaceAll(guild.id, actionGrants);
  res.redirect(`/dashboard/${guild.id}/permissions`);
});

module.exports = router;
