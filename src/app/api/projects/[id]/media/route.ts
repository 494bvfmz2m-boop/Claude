import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import { UPLOADS_DIR } from "@/lib/paths";
import { probeFile } from "@/lib/ffprobe";
import type { Media } from "@/lib/types";

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v", ".avi"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const originalName = file.name || "upload.mp4";
  const ext = path.extname(originalName).toLowerCase() || ".mp4";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
      { status: 400 }
    );
  }

  const storedFilename = `${randomUUID()}${ext}`;
  const destPath = path.join(UPLOADS_DIR, storedFilename);

  try {
    const webStream = file.stream() as unknown as ReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(webStream as never), fs.createWriteStream(destPath));

    const probe = await probeFile(destPath);

    const db = getDb();
    const mediaId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO media (id, project_id, filename, original_name, duration, width, height, has_audio, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      mediaId,
      id,
      storedFilename,
      originalName,
      probe.duration,
      probe.width,
      probe.height,
      probe.hasAudio ? 1 : 0,
      now
    );
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, id);

    const media = db.prepare("SELECT * FROM media WHERE id = ?").get(mediaId) as Media;
    return NextResponse.json({ media }, { status: 201 });
  } catch (err) {
    fs.rm(destPath, { force: true }, () => {});
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process upload" },
      { status: 400 }
    );
  }
}
