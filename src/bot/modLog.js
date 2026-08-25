const { ModActions } = require('../db/repo');

// Shared by moderation.js, promotion.js, swearFilter.js, and the web
// dashboard's own punishment routes, so every action ends up in one place
// regardless of whether it came from a slash command or the site.
function recordModAction(guildId, { action, target, moderator, reason, source }) {
  ModActions.log(guildId, {
    action,
    targetId: target?.id ?? target ?? null,
    targetTag: target?.tag ?? target?.username ?? null,
    moderatorId: moderator.id,
    moderatorTag: moderator.tag ?? moderator.username ?? null,
    reason: reason || null,
    source: source || 'discord',
  });
}

module.exports = { recordModAction };
