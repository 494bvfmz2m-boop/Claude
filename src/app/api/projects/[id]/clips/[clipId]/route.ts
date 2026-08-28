import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import type { Clip, Media } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, clipId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const clip = db
    .prepare("SELECT * FROM clips WHERE id = ? AND project_id = ?")
    .get(clipId, id) as Clip | undefined;
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const media = db.prepare("SELECT * FROM media WHERE id = ?").get(clip.media_id) as Media;

  const body = await req.json().catch(() => null);
  const inPoint = typeof body?.inPoint === "number" ? body.inPoint : clip.in_point;
  const outPoint = typeof body?.outPoint === "number" ? body.outPoint : clip.out_point;

  if (inPoint < 0 || outPoint > media.duration || outPoint - inPoint < 0.1) {
    return NextResponse.json(
      {
        error: `Invalid trim range. Must be within 0 and ${media.duration.toFixed(
          2
        )}s, and at least 0.1s long.`,
      },
      { status: 400 }
    );
  }

  db.prepare("UPDATE clips SET in_point = ?, out_point = ? WHERE id = ?").run(
    inPoint,
    outPoint,
    clipId
  );
  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  const updated = db.prepare("SELECT * FROM clips WHERE id = ?").get(clipId) as Clip;
  return NextResponse.json({ clip: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, clipId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const clip = db
    .prepare("SELECT * FROM clips WHERE id = ? AND project_id = ?")
    .get(clipId, id) as Clip | undefined;
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("DELETE FROM clips WHERE id = ?").run(clipId);

  // Renumber remaining positions so they stay contiguous.
  const remaining = db
    .prepare("SELECT id FROM clips WHERE project_id = ? ORDER BY position ASC")
    .all(id) as { id: string }[];
  const update = db.prepare("UPDATE clips SET position = ? WHERE id = ?");
  remaining.forEach((c, idx) => update.run(idx, c.id));

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  return NextResponse.json({ ok: true });
}
