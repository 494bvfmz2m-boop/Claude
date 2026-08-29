const { Events } = require('discord.js');
const { RoleTriggers } = require('../db/repo');

// Resolves every rule that fires off of `gainedRoleIds` in one synchronous
// pass, including cascades (a rule's added role can itself be another
// rule's trigger) -- rather than re-running per Discord API round trip,
// which would risk ping-pong loops between two rules that trigger each
// other. `processed` bounds the walk to at most one visit per role, so a
// cycle (A adds B, B adds A) just terminates instead of looping.
async function applyRoleTriggers(member, gainedRoleIds) {
  const rules = RoleTriggers.listForGuild(member.guild.id);
  if (rules.length === 0) return;

  const currentRoles = new Set(member.roles.cache.keys());
  const toAdd = new Set();
  const toRemove = new Set();
  const processed = new Set();
  const queue = [...gainedRoleIds];

  while (queue.length > 0) {
    const roleId = queue.shift();
    if (processed.has(roleId)) continue;
    processed.add(roleId);

    for (const rule of rules) {
      if (rule.trigger_role_id !== roleId) continue;
      if (!currentRoles.has(rule.add_role_id) && !toAdd.has(rule.add_role_id)) {
        toAdd.add(rule.add_role_id);
        queue.push(rule.add_role_id);
      }
      if (rule.remove_role_id) toRemove.add(rule.remove_role_id);
    }
  }

  for (const id of toRemove) toAdd.delete(id); // a remove always wins over an add of the same role
  const removeList = [...toRemove].filter((id) => currentRoles.has(id));
  const addList = [...toAdd];

  if (addList.length > 0) await member.roles.add(addList).catch(() => {});
  if (removeList.length > 0) await member.roles.remove(removeList).catch(() => {});
}

function register(client) {
  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    const oldRoles = new Set(oldMember.roles.cache.keys());
    const gained = [...newMember.roles.cache.keys()].filter((id) => !oldRoles.has(id));
    if (gained.length === 0) return;
    applyRoleTriggers(newMember, gained).catch(() => {});
  });
}

module.exports = { register, applyRoleTriggers };
