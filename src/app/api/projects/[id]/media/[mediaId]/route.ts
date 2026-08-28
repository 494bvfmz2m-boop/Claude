import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import { UPLOADS_DIR } from "@/lib/paths";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, mediaId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const media = db
    .prepare("SELECT * FROM media WHERE id = ? AND project_id = ?")
    .get(mediaId, id) as { filename: string } | undefined;
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const inUse = db
    .prepare("SELECT COUNT(*) as c FROM clips WHERE media_id = ?")
    .get(mediaId) as { c: number };
  if (inUse.c > 0) {
    return NextResponse.json(
      { error: "This clip is used on the timeline — remove it from the timeline first." },
      { status: 409 }
    );
  }

  db.prepare("DELETE FROM media WHERE id = ?").run(mediaId);
  fs.rm(path.join(UPLOADS_DIR, media.filename), { force: true }, () => {});

  return NextResponse.json({ ok: true });
}
