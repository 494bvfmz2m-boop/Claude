import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const orderedIds: unknown = body?.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((v) => typeof v !== "string")) {
    return NextResponse.json({ error: "orderedIds must be an array of clip ids" }, { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM clips WHERE project_id = ?")
    .all(id) as { id: string }[];
  const existingIds = new Set(existing.map((c) => c.id));

  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((cid) => existingIds.has(cid as string))
  ) {
    return NextResponse.json(
      { error: "orderedIds must contain exactly the project's current clip ids" },
      { status: 400 }
    );
  }

  const update = db.prepare("UPDATE clips SET position = ? WHERE id = ?");
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((cid, idx) => update.run(idx, cid));
  });
  tx(orderedIds as string[]);

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  return NextResponse.json({ ok: true });
}
