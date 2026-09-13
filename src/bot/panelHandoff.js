const { Panels, ReactionRolePanels } = require('../db/repo');
const { buildPanelMessage } = require('./panelMessage');
const { postPanel } = require('./reactionRoles');

// A posted ticket panel or reaction-role panel is just a Discord message --
// and Discord only ever lets the bot APPLICATION that originally posted a
// message edit it, regardless of what permissions another bot has in the
// channel. So whenever the bot actually serving a guild changes (a custom
// bot connects and takes over from the shared bot, or a custom bot
// disconnects and the shared bot falls back), every already-posted panel
// has to be deleted and reposted under the new bot's own identity, or its
// buttons/reactions stop working entirely: Discord routes a component
// interaction to whichever application posted the message, not to
// whichever bot happens to be in the guild right now.
//
// Safe to call on every connect/reconnect -- a panel whose live message is
// already authored by `guild.client` (the bot that's about to serve it) is
// left completely alone, so this is a no-op once a handoff has already
// happened.
async function handoffPostedPanels(guildId, guild) {
  const myId = guild.client.user.id;

  for (const panel of Panels.listForGuild(guildId)) {
    if (!panel.channel_id || !panel.message_id) continue;
    const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) continue;
    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
    if (old?.author.id === myId) continue;
    if (old) await old.delete().catch(() => {});
    const sent = await channel.send(buildPanelMessage(panel)).catch(() => null);
    if (sent) Panels.setDeployed(panel.id, channel.id, sent.id);
  }

  // listAllForGuild, not listForGuild -- a tier-disabled panel can still
  // have a live posted message (with its buttons/reactions stripped, see
  // tierEnforcement.js), which needs the same handoff as an enabled one.
  for (const panel of ReactionRolePanels.listAllForGuild(guildId)) {
    if (!panel.channel_id || !panel.message_id) continue;
    const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) continue;
    const old = await channel.messages.fetch(panel.message_id).catch(() => null);
    if (old?.author.id === myId) continue;
    if (old) await old.delete().catch(() => {});
    const sent = await postPanel(guild, channel, panel).catch(() => null);
    if (sent) ReactionRolePanels.setDeployed(panel.id, channel.id, sent.id);
  }
}

module.exports = { handoffPostedPanels };
