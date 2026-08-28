import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import type { Clip } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, clipId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const atSeconds = typeof body?.atSeconds === "number" ? body.atSeconds : null;
  if (atSeconds === null) {
    return NextResponse.json({ error: "atSeconds is required" }, { status: 400 });
  }

  const db = getDb();
  const clip = db
    .prepare("SELECT * FROM clips WHERE id = ? AND project_id = ?")
    .get(clipId, id) as Clip | undefined;
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const splitPoint = clip.in_point + atSeconds;
  if (splitPoint <= clip.in_point + 0.1 || splitPoint >= clip.out_point - 0.1) {
    return NextResponse.json(
      { error: "Split point must be at least 0.1s inside the clip on both sides" },
      { status: 400 }
    );
  }

  const newClipId = randomUUID();

  const tx = db.transaction(() => {
    db.prepare("UPDATE clips SET out_point = ? WHERE id = ?").run(splitPoint, clip.id);

    db.prepare(
      `UPDATE clips SET position = position + 1 WHERE project_id = ? AND position > ?`
    ).run(id, clip.position);

    db.prepare(
      `INSERT INTO clips (id, project_id, media_id, position, in_point, out_point)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(newClipId, id, clip.media_id, clip.position + 1, splitPoint, clip.out_point);
  });
  tx();

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  const clips = db
    .prepare("SELECT * FROM clips WHERE project_id = ? ORDER BY position ASC")
    .all(id) as Clip[];
  return NextResponse.json({ clips });
}
