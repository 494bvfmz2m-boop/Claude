const fs = require('fs');
const path = require('path');
const { dataDir } = require('./config');

const FILE = path.join(dataDir, 'data.json');

const defaults = () => ({
  snippets: {},
  reminders: [],
  reactionRoles: {},
  faqs: {},
  stats: { conversations: [], hours: Array(24).fill(0) },
  suggestions: { channelId: null, count: 0, items: {} },
  movieNights: {},
});

const storage = {
  data: defaults(),

  load() {
    try {
      storage.data = { ...defaults(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    } catch (err) {
      if (err.code === 'ENOENT') return;
      // Keep the unreadable file around instead of overwriting it on the next save.
      const backup = `${FILE}.broken-${Date.now()}`;
      console.error(`Could not read ${FILE} (${err.message}), moved it to ${backup}`);
      fs.renameSync(FILE, backup);
    }
  },

  save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const tmp = `${FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(storage.data, null, 2));
      fs.renameSync(tmp, FILE);
    } catch (err) {
      console.error(`Could not save ${FILE}:`, err.message);
    }
  },
};

module.exports = storage;
