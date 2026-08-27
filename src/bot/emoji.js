const config = require('../config');

const EMOJI_BASE = `${(config.dashboardUrl || '').replace(/\/+$/, '')}/img/emoji`;

// These are plain image files (not uploaded as Discord custom emoji anywhere),
// used as embed thumbnails via URL -- Discord renders an animated GIF
// thumbnail as actually animated, so this gets the "emoji" motion without
// needing a guild to upload them to.
function emojiUrl(name) {
  return config.dashboardUrl ? `${EMOJI_BASE}/${name}` : null;
}

module.exports = { emojiUrl };
