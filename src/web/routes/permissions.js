const express = require('express');
const { DashboardRoleAccess } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { AREAS, AREA_KEYS } = require('../lib/dashboardAccess');

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

function rolesWithGrants(guild) {
  const grants = new Map(DashboardRoleAccess.listForGuild(guild.id).map((g) => [g.roleId, new Set(g.areas)]));
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id) // skip @everyone -- granting it would hand access to the whole server
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color !== 0 ? r.hexColor : '#99aab5',
      areas: grants.get(r.id) || new Set(),
    }));
}

router.get('/permissions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('permissions', { guild, roles: rolesWithGrants(guild), areas: AREAS });
});

router.post('/permissions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  // One checkbox per role/area, named area_<areaKey>[] with the role id as
  // the value -- matches how the form is laid out (a row per role).
  const grants = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .map((r) => {
      const areas = AREAS
        .map((a) => a.key)
        .filter((key) => [].concat(req.body[`area_${key}`] || []).includes(r.id));
      return { roleId: r.id, areas };
    })
    .filter((g) => g.areas.length > 0);

  DashboardRoleAccess.replaceAll(guild.id, grants);
  res.redirect(`/dashboard/${guild.id}/permissions`);
});

module.exports = router;
