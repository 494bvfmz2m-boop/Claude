const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'reminders.json');

let data = null;

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    data = { nextId: 1, guildConfig: {}, reminders: {} };
    save();
  } else {
    data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    data.guildConfig ??= {};
    data.reminders ??= {};
    data.nextId ??= 1;
  }
  return data;
}

function save() {
  ensureDir();
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
}

function getGuildConfig(guildId) {
  return data.guildConfig[guildId] || null;
}

function setGuildChannel(guildId, channelId) {
  data.guildConfig[guildId] = { ...(data.guildConfig[guildId] || {}), channelId };
  save();
}

function createReminder(fields) {
  const id = data.nextId++;
  const reminder = { id, active: true, createdAt: DateTimeNowISO(), ...fields };
  data.reminders[id] = reminder;
  save();
  return reminder;
}

function DateTimeNowISO() {
  return new Date().toISOString();
}

function getReminder(id) {
  return data.reminders[id] || null;
}

function updateReminder(id, patch) {
  if (!data.reminders[id]) return null;
  data.reminders[id] = { ...data.reminders[id], ...patch };
  save();
  return data.reminders[id];
}

function deleteReminder(id) {
  if (!data.reminders[id]) return false;
  delete data.reminders[id];
  save();
  return true;
}

function listReminders({ guildId, activeOnly = true } = {}) {
  return Object.values(data.reminders).filter((r) => {
    if (activeOnly && !r.active) return false;
    if (guildId && r.guildId !== guildId) return false;
    return true;
  });
}

function listAllActiveReminders() {
  return Object.values(data.reminders).filter((r) => r.active);
}

module.exports = {
  load,
  save,
  getGuildConfig,
  setGuildChannel,
  createReminder,
  getReminder,
  updateReminder,
  deleteReminder,
  listReminders,
  listAllActiveReminders,
};
