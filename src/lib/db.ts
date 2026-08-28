import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { DB_PATH } from "./paths";

let db: Database.Database | null = null;

function init(database: Database.Database) {
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      resolution_w INTEGER NOT NULL DEFAULT 1920,
      resolution_h INTEGER NOT NULL DEFAULT 1080,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      duration REAL NOT NULL,
      width INTEGER,
      height INTEGER,
      has_audio INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      media_id TEXT NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL,
      in_point REAL NOT NULL,
      out_point REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS overlays (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      position TEXT NOT NULL DEFAULT 'bottom',
      font_size INTEGER NOT NULL DEFAULT 48,
      color TEXT NOT NULL DEFAULT '#ffffff'
    );

    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued',
      output_filename TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_project ON media(project_id);
    CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
    CREATE INDEX IF NOT EXISTS idx_overlays_project ON overlays(project_id);
    CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs(project_id);
  `);

  // Stale jobs from a previous process (e.g. container restart mid-render).
  database
    .prepare(
      `UPDATE render_jobs SET status = 'error', error = 'Interrupted by server restart', updated_at = ?
       WHERE status IN ('queued', 'processing')`
    )
    .run(new Date().toISOString());

  seedUsers(database);
}

function seedUsers(database: Database.Database) {
  const existing = database.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (existing.c > 0) return;

  const pairs: Array<[string | undefined, string | undefined]> = [
    [process.env.AUTH_USER_1, process.env.AUTH_PASS_1],
    [process.env.AUTH_USER_2, process.env.AUTH_PASS_2],
  ];

  const insert = database.prepare(
    "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)"
  );

  let seeded = 0;
  for (const [username, password] of pairs) {
    if (!username || !password) continue;
    const hash = bcrypt.hashSync(password, 10);
    insert.run(randomUUID(), username, hash);
    seeded++;
  }

  if (seeded === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[clipforge] No AUTH_USER_1/AUTH_PASS_1 (or _2) env vars set — no users were created. Set them and restart."
    );
  }
}

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    init(db);
  }
  return db;
}
