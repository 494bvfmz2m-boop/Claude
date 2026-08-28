const express = require('express');
const { EmbedBuilder } = require('discord.js');
const { DashboardRoleAccess, CommandPermissions } = require('../../db/repo');
const { getGuildOr404 } = require('../lib/getGuild');
const { AREAS } = require('../lib/dashboardAccess');
const { ACTIONS } = require('../../bot/commandPermissions');
const config = require('../../config');

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

function allRoles(guild) {
  return [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
}

function nonEveryoneRoles(guild) {
  return allRoles(guild).filter((r) => r.id !== guild.id); // skip @everyone -- granting it would hand access to the whole server
}

// Every role on the server, including @everyone -- shown so the page is a
// complete picture of the server's roles, but @everyone is flagged so the
// view can lock it out of the checkboxes entirely (it's never included in
// nonEveryoneRoles, so the POST handler can't grant it anything either way).
function rolesWithGrants(guild) {
  const areaGrants = new Map(DashboardRoleAccess.listForGuild(guild.id).map((g) => [g.roleId, new Set(g.areas)]));
  const actionGrants = new Map();
  CommandPermissions.listForGuild(guild.id).forEach(({ roleId, action }) => {
    if (!actionGrants.has(roleId)) actionGrants.set(roleId, new Set());
    actionGrants.get(roleId).add(action);
  });

  return allRoles(guild).map((r) => ({
    id: r.id,
    name: r.id === guild.id ? '@everyone' : r.name,
    color: r.color !== 0 ? r.hexColor : '#99aab5',
    memberCount: r.members.size,
    isEveryone: r.id === guild.id,
    areas: areaGrants.get(r.id) || new Set(),
    actions: actionGrants.get(r.id) || new Set(),
  }));
}

function notice(req) {
  return req.query.msg ? { ok: req.query.ok === '1', text: req.query.msg } : null;
}

router.get('/permissions', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;
  res.render('permissions', { guild, roles: rolesWithGrants(guild), areas: AREAS, moderationActions: ACTIONS, notice: notice(req) });
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

function buildExplainerEmbed(guild, role, areas, actions) {
  const embed = new EmbedBuilder()
    .setColor(role.color || 0x99aab5)
    .setTitle(`Your access in ${guild.name}`)
    .setDescription(`You have the **${role.name}** role, which grants the following. If anything here looks wrong, ask a server admin.`)
    .setTimestamp();
  if (guild.iconURL()) embed.setThumbnail(guild.iconURL());

  if (areas.length > 0) {
    embed.addFields({
      name: '🖥️ Dashboard pages you can open',
      value: areas.map((a) => `**${a.label}** — ${a.description}`).join('\n'),
    });
  }
  if (actions.length > 0) {
    embed.addFields({
      name: '🛡️ Commands you can use',
      value: actions.map((a) => `\`${a.usage}\` — ${a.description}`).join('\n'),
    });
  }
  if (areas.length > 0 && config.dashboardUrl) {
    embed.addFields({ name: 'Dashboard', value: `${config.dashboardUrl.replace(/\/+$/, '')}/dashboard/${guild.id}` });
  }
  return embed;
}

// Bulk-DMs every non-bot member holding this role an embed explaining what
// their role grants -- so an owner doesn't have to explain permissions to
// staff by hand every time someone's added to a role. Sends exactly what's
// currently saved for the role, so unsaved checkbox changes on this page
// aren't reflected until "Save permissions" runs first.
router.post('/permissions/dm/:roleId', async (req, res) => {
  const guild = await getGuildOr404(req, res);
  if (!guild) return;

  const role = guild.roles.cache.get(req.params.roleId);
  if (!role || role.id === guild.id) {
    return res.redirect(`/dashboard/${guild.id}/permissions?msg=${encodeURIComponent("That role doesn't exist.")}&ok=0`);
  }

  const areaGrant = DashboardRoleAccess.listForGuild(guild.id).find((g) => g.roleId === role.id);
  const actionKeys = new Set(CommandPermissions.listForGuild(guild.id).filter((g) => g.roleId === role.id).map((g) => g.action));
  const areas = AREAS.filter((a) => areaGrant && areaGrant.areas.includes(a.key));
  const actions = ACTIONS.filter((a) => actionKeys.has(a.key));

  if (areas.length === 0 && actions.length === 0) {
    return res.redirect(`/dashboard/${guild.id}/permissions?msg=${encodeURIComponent(`${role.name} doesn't have anything granted yet -- nothing to send.`)}&ok=0`);
  }

  await guild.members.fetch().catch(() => {});
  const members = [...role.members.values()].filter((m) => !m.user.bot);

  if (members.length === 0) {
    return res.redirect(`/dashboard/${guild.id}/permissions?msg=${encodeURIComponent(`Nobody on this server currently has the ${role.name} role.`)}&ok=0`);
  }

  const embed = buildExplainerEmbed(guild, role, areas, actions);
  const results = await Promise.all(members.map((m) => m.send({ embeds: [embed] }).then(() => true).catch(() => false)));
  const sent = results.filter(Boolean).length;
  const failed = results.length - sent;

  let text = `Sent to ${sent} of ${members.length} member${members.length === 1 ? '' : 's'} with the ${role.name} role.`;
  if (failed > 0) text += ` ${failed} couldn't be DMed (DMs closed).`;
  res.redirect(`/dashboard/${guild.id}/permissions?msg=${encodeURIComponent(text)}&ok=${failed === 0 ? '1' : '0'}`);
});

module.exports = router;
