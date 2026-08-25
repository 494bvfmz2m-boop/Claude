const db = require('./database');

const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20h, a little forgiving vs a strict 24h
const DAILY_MIN = 100;
const DAILY_MAX = 250;

function ensureRow(guildId, userId) {
  db.prepare(`
    INSERT INTO economy (guild_id, user_id, balance)
    VALUES (?, ?, 0)
    ON CONFLICT(guild_id, user_id) DO NOTHING
  `).run(guildId, userId);
}

const Economy = {
  getBalance(guildId, userId) {
    ensureRow(guildId, userId);
    return db.prepare('SELECT balance FROM economy WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId).balance;
  },

  addBalance(guildId, userId, amount) {
    ensureRow(guildId, userId);
    db.prepare('UPDATE economy SET balance = MAX(0, balance + ?) WHERE guild_id = ? AND user_id = ?')
      .run(amount, guildId, userId);
    return Economy.getBalance(guildId, userId);
  },

  claimDaily(guildId, userId) {
    ensureRow(guildId, userId);
    const row = db.prepare('SELECT last_daily FROM economy WHERE guild_id = ? AND user_id = ?')
      .get(guildId, userId);

    const now = Date.now();
    if (row.last_daily) {
      const elapsed = now - new Date(row.last_daily + 'Z').getTime();
      if (elapsed < DAILY_COOLDOWN_MS) {
        return { claimed: false, msRemaining: DAILY_COOLDOWN_MS - elapsed };
      }
    }

    const amount = DAILY_MIN + Math.floor(Math.random() * (DAILY_MAX - DAILY_MIN + 1));
    db.prepare(`
      UPDATE economy SET balance = balance + ?, last_daily = datetime('now')
      WHERE guild_id = ? AND user_id = ?
    `).run(amount, guildId, userId);

    return { claimed: true, amount, balance: Economy.getBalance(guildId, userId) };
  },

  leaderboard(guildId, limit = 10) {
    return db.prepare(`
      SELECT user_id, balance FROM economy
      WHERE guild_id = ? AND balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `).all(guildId, limit);
  },
};

module.exports = { Economy };
