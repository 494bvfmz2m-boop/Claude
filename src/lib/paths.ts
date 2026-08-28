import path from "node:path";
import fs from "node:fs";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const RENDERS_DIR = path.join(DATA_DIR, "renders");
export const DB_PATH = path.join(DATA_DIR, "clipforge.db");

for (const dir of [DATA_DIR, UPLOADS_DIR, RENDERS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
