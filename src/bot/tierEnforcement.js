const {
  TicketTypes, Panels, ReactionRolePanels, Tags, ScheduledAnnouncements,
  TebexSubscribers, TebexTiers, CustomBots,
} = require('../db/repo');
const { limitFor } = require('../web/lib/tierLimits');
const { tierHasFeature } = require('../web/lib/subscriptionGate');
const { resolveGuild } = require('./clientRegistry');
const { buildPanelMessage } = require('./panelMessage');
const { stopCustomBot } = require('./customBots');

// Re-renders a panel's live posted message (if it has one) so its buttons/
// dropdown match whatever's currently in ticket_type_ids -- called whenever
// a ticket type a posted panel references disappears out from under it
// (deleted directly, or trimmed by enforceGuildLimits below), so a
// still-live panel message never keeps a dead button pointing at a type
// that no longer exists.
async function refreshPostedPanel(guildId, panel) {
  if (!panel.channel_id || !panel.message_id) return;
  const guild = resolveGuild(guildId);
  if (!guild) return;
  try {
    const channel = await guild.channels.fetch(panel.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const message = await channel.messages.fetch(panel.message_id).catch(() => null);
    if (!message) return;
    await message.edit(buildPanelMessage(panel));
  } catch { /* best-effort -- a stale/deleted channel or message shouldn't block enforcement */ }
}

// Drops the given ticket type IDs out of every panel in the guild that
// references them, and refreshes each affected panel's live posted
// message to match.
async function pruneTicketTypesFromPanels(guildId, deletedIds) {
  if (deletedIds.length === 0) return;
  const deleted = new Set(deletedIds);
  for (const panel of Panels.listForGuild(guildId)) {
    if (!panel.ticket_type_ids.some((id) => deleted.has(id))) continue;
    const kept = panel.ticket_type_ids.filter((id) => !deleted.has(id));
    Panels.update(panel.id, { ...panel, ticketTypeIds: kept });
    await refreshPostedPanel(guildId, { ...panel, ticket_type_ids: kept });
  }
}

// Trims a guild's ticket types, reaction-role panels, tags, and scheduled
// announcements down to whatever its CURRENT subscription state allows,
// and disconnects a custom bot the guild's current tier no longer
// includes -- call this any time that state might have gone DOWN for a
// guild: a subscription is revoked/cancelled, downgraded to a lower tier,
// or moved off this guild onto another one. A no-op wherever the guild is
// still under its limits. Deletes the newest entries first, keeping
// whichever were created earliest -- what they had before a subscription
// gave them extra room is what survives a downgrade.
async function enforceGuildLimits(guildId) {
  const ticketTypes = TicketTypes.listForGuild(guildId);
  const ticketLimit = limitFor('max_ticket_types', guildId, {});
  if (ticketTypes.length > ticketLimit) {
    const toDelete = ticketTypes.slice(ticketLimit);
    for (const t of toDelete) TicketTypes.delete(t.id);
    await pruneTicketTypesFromPanels(guildId, toDelete.map((t) => t.id));
  }

  const rrPanels = ReactionRolePanels.listForGuild(guildId);
  const rrLimit = limitFor('max_reaction_role_panels', guildId, {});
  if (rrPanels.length > rrLimit) {
    for (const p of rrPanels.slice(rrLimit)) ReactionRolePanels.delete(p.id);
  }

  const tags = Tags.listForGuild(guildId);
  const tagLimit = limitFor('max_tags', guildId, {});
  if (tags.length > tagLimit) {
    for (const t of tags.slice(tagLimit)) Tags.delete(t.id);
  }

  const announcements = ScheduledAnnouncements.listForGuild(guildId);
  const annLimit = limitFor('max_scheduled_announcements', guildId, {});
  if (announcements.length > annLimit) {
    for (const a of announcements.slice(annLimit)) ScheduledAnnouncements.delete(a.id);
  }

  // The custom bot isn't capped by count -- it's a live gateway connection
  // that, once started, keeps running indefinitely on its own regardless
  // of subscription state unless explicitly stopped. So the moment this
  // guild's current tier doesn't include custom_bot, cut it off for real
  // (falls straight back to the shared bot) rather than just leaving the
  // dashboard page locked while the bot itself keeps running.
  const subscriber = TebexSubscribers.forGuild(guildId);
  const tier = subscriber ? TebexTiers.get(subscriber.tier_id) : null;
  if (!tierHasFeature(tier, 'custom_bot') && CustomBots.get(guildId)) {
    await stopCustomBot(guildId);
    // stopCustomBot only tears down the live connection -- it deliberately
    // doesn't touch the row (the token stays stored so resubscribing just
    // needs a "Try connecting" click, not a re-upload), but its `status`
    // needs updating too or the Custom Bot page would keep showing
    // "connected" for a bot that's actually been disconnected.
    CustomBots.setStopped(guildId);
  }
}

module.exports = { enforceGuildLimits, pruneTicketTypesFromPanels };
