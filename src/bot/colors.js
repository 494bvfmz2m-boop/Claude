// Single source of truth for every embed color used across the bot. Was
// previously the same handful of hex values retyped as a differently-named
// local constant in 25+ files (MOD_COLOR, LOCK_COLOR, PROMO_COLOR, POLL_
// COLOR, ...) -- harmless as long as nobody ever wants to rebrand, but that
// meant a find-and-replace across the whole codebase instead of an edit
// here. Every one of those files now sources its constant's VALUE from
// here; the local constant names are left alone so nothing downstream
// (.setColor(MOD_COLOR), etc.) had to change.
module.exports = {
  BRAND: '#a32ee2', // XyphrosMod purple -- the default for anything without a more specific meaning
  DANGER: '#ed4245', // bans, deletions, locks, errors
  SUCCESS: '#23a55a', // unlocks, welcomes, approvals
  WARNING: '#d97706', // beta-gate "you're not allowlisted" notice
  DISCORD_BLURPLE: '#5865F2', // beta-gate "request submitted" notice
};
