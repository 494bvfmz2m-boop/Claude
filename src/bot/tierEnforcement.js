const { EmbedBuilder } = require('discord.js');
const {
  TicketTypes, Panels, ReactionRolePanels, Tags, ScheduledAnnouncements,
  TebexSubscribers, TebexTiers, CustomBots,
} = require('../db/repo');
const { limitFor } = require('../web/lib/tierLimits');
const { tierHasFeature } = require('../web/lib/subscriptionGate');
const { resolveGuild, mainClient } = require('./clientRegistry');
const { buildPanelMessage } = require('./panelMessage');
const { stopCustomBot } = require('./customBots');
const { buildGenericInviteUrl } = require('../web/lib/discordOAuth');

// Discord gives bots no way to add themselves to a server -- only a human
// clicking an OAuth invite link can do that. The main bot is deliberately
// never kicked when a custom bot takes over (see clientRegistry.js's
// guardClientEvents), so it's normally still sitting there ready to resume
// the instant a custom bot disconnects -- but if the server owner removed
// it themselves at some point, there's genuinely nothing left running
// there and no way to fix that automatically. Best we can do is tell them.
async function notifyIfMainBotMissing(guildId, subscriber) {
  if (mainClient.guilds.cache.has(guildId)) return;
  if (!subscriber?.discord_user_id) return;
  try {
    const user = await mainClient.users.fetch(subscriber.discord_user_id);
    const embed = new EmbedBuilder()
      .setTitle('Your custom bot was disconnected')
      .setDescription(
        "Your Custom subscription is no longer active, so your own bot has been disconnected. "
        + "Normally the shared XyphrosMod bot would automatically take back over so your server "
        + "isn't left with nothing -- but it looks like it's not in that server anymore. "
        + `[Click here to re-invite it](${buildGenericInviteUrl()}) to restore basic functionality.`,
      )
      .setColor('#a32ee2');
    await user.send({ embeds: [embed] }).catch(() => {});
  } catch { /* can't reach them by DM -- nothing more we can do automatically */ }
}

// Re-renders a panel's live posted message (if it has one) so its buttons/
// dropdown match whichever of its ticket types are currently enabled --
// called whenever a type a posted panel references changes tier_disabled
// state, or is permanently deleted, so a still-live panel message is never
// stale in either direction (a dead button left behind, or a type that
// came back not reappearing).
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

// Refreshes every posted panel in the guild that references any of the
// given ticket type IDs -- for when those types' enabled/disabled state
// just changed (their buttons need to show/hide accordingly) but the
// panel's own ticket_type_ids list isn't being touched.
async function refreshPanelsReferencingTypes(guildId, typeIds) {
  if (typeIds.length === 0) return;
  const affected = new Set(typeIds);
  for (const panel of Panels.listForGuild(guildId)) {
    if (panel.ticket_type_ids.some((id) => affected.has(id))) {
      await refreshPostedPanel(guildId, panel);
    }
  }
}

// Permanently deletes a ticket type (a real, deliberate delete -- e.g. the
// dashboard's own "Delete ticket type" button) and strips it out of every
// panel that referenced it, refreshing each affected panel's live message.
// Unlike tier-driven disabling below, there's no coming back from this one.
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

// Reconciles one resource type's enabled/disabled state against a guild's
// CURRENT limit -- the oldest `limit` rows (by id) end up enabled, anything
// beyond that ends up disabled, regardless of which direction this moves
// existing rows (a downgrade disables the newest excess; an upgrade or a
// fresh subscription re-enables whatever there's now room for, oldest
// first). Only actually writes rows whose state needs to change. Returns
// the list of ticket type IDs that flipped either way, so the caller can
// refresh any panels referencing them.
function reconcileResource(repo, guildId, limitKey) {
  const all = repo.listAllForGuild(guildId);
  const limit = limitFor(limitKey, guildId, {});
  const changedIds = [];
  all.forEach((row, index) => {
    const shouldBeEnabled = index < limit;
    const isEnabled = !row.tier_disabled;
    if (shouldBeEnabled !== isEnabled) {
      repo.setTierDisabled(row.id, !shouldBeEnabled);
      changedIds.push(row.id);
    }
  });
  return changedIds;
}

// Brings a guild's ticket types, reaction-role panels, tags, and scheduled
// announcements in line with whatever its CURRENT subscription state
// allows, and starts/stops its custom bot to match -- call this any time
// that state might have changed for a guild, in EITHER direction:
// subscription revoked/cancelled/downgraded (disables the newest excess),
// or upgraded/newly applied/moved onto this guild (re-enables whatever
// there's now room for). Nothing is ever deleted here -- a customer's
// actual configuration survives a subscription change either way, they
// just temporarily can't use more than their current plan allows.
async function enforceGuildLimits(guildId) {
  const changedTicketTypeIds = reconcileResource(TicketTypes, guildId, 'max_ticket_types');
  await refreshPanelsReferencingTypes(guildId, changedTicketTypeIds);

  reconcileResource(ReactionRolePanels, guildId, 'max_reaction_role_panels');
  reconcileResource(Tags, guildId, 'max_tags');
  reconcileResource(ScheduledAnnouncements, guildId, 'max_scheduled_announcements');

  // The custom bot isn't capped by count -- it's a live gateway connection
  // that, once started, keeps running indefinitely on its own regardless
  // of subscription state unless explicitly stopped/restarted. So this
  // handles it directly rather than through reconcileResource.
  const subscriber = TebexSubscribers.forGuild(guildId);
  const tier = subscriber ? TebexTiers.get(subscriber.tier_id) : null;
  const custom = CustomBots.get(guildId);
  if (!tierHasFeature(tier, 'custom_bot') && custom && custom.status !== 'stopped') {
    await stopCustomBot(guildId);
    // stopCustomBot only tears down the live connection -- it deliberately
    // doesn't touch the row (the token stays stored so resubscribing just
    // needs a "Try connecting" click, not a re-upload), but its `status`
    // needs updating too or the Custom Bot page would keep showing
    // "connected" for a bot that's actually been disconnected.
    CustomBots.setStopped(guildId);
    await notifyIfMainBotMissing(guildId, subscriber);
  }
}

module.exports = { enforceGuildLimits, pruneTicketTypesFromPanels };
