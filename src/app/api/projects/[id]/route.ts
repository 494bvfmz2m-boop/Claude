import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import { UPLOADS_DIR, RENDERS_DIR } from "@/lib/paths";
import type { Clip, Media, Overlay, ProjectBundle } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const media = db
    .prepare("SELECT * FROM media WHERE project_id = ? ORDER BY created_at ASC")
    .all(id) as Media[];
  const clips = db
    .prepare("SELECT * FROM clips WHERE project_id = ? ORDER BY position ASC")
    .all(id) as Clip[];
  const overlays = db
    .prepare("SELECT * FROM overlays WHERE project_id = ? ORDER BY start_time ASC")
    .all(id) as Overlay[];

  const bundle: ProjectBundle = { project, media, clips, overlays };
  return NextResponse.json(bundle);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const media = db.prepare("SELECT filename FROM media WHERE project_id = ?").all(id) as {
    filename: string;
  }[];
  const jobs = db
    .prepare("SELECT output_filename FROM render_jobs WHERE project_id = ? AND output_filename IS NOT NULL")
    .all(id) as { output_filename: string }[];

  db.prepare("DELETE FROM projects WHERE id = ?").run(id);

  for (const m of media) {
    fs.rm(path.join(UPLOADS_DIR, m.filename), { force: true }, () => {});
  }
  for (const j of jobs) {
    fs.rm(path.join(RENDERS_DIR, j.output_filename), { force: true }, () => {});
  }

  return NextResponse.json({ ok: true });
}
