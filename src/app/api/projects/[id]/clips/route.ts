import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import type { Clip, Media } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId : null;
  if (!mediaId) return NextResponse.json({ error: "mediaId is required" }, { status: 400 });

  const db = getDb();
  const media = db
    .prepare("SELECT * FROM media WHERE id = ? AND project_id = ?")
    .get(mediaId, id) as Media | undefined;
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) as maxPos FROM clips WHERE project_id = ?")
    .get(id) as { maxPos: number };

  const clipId = randomUUID();
  db.prepare(
    `INSERT INTO clips (id, project_id, media_id, position, in_point, out_point) VALUES (?, ?, ?, ?, 0, ?)`
  ).run(clipId, id, mediaId, maxPos.maxPos + 1, media.duration);

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  const clip = db.prepare("SELECT * FROM clips WHERE id = ?").get(clipId) as Clip;
  return NextResponse.json({ clip }, { status: 201 });
}
