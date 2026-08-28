import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import type { Overlay } from "@/lib/types";

const VALID_POSITIONS = new Set(["top", "center", "bottom"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; overlayId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, overlayId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM overlays WHERE id = ? AND project_id = ?")
    .get(overlayId, id) as Overlay | undefined;
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : existing.text;
  const startTime = typeof body?.startTime === "number" ? body.startTime : existing.start_time;
  const endTime = typeof body?.endTime === "number" ? body.endTime : existing.end_time;
  const position = VALID_POSITIONS.has(body?.position) ? body.position : existing.position;
  const fontSize = typeof body?.fontSize === "number" ? body.fontSize : existing.font_size;
  const color = typeof body?.color === "string" ? body.color : existing.color;

  if (!text) return NextResponse.json({ error: "text cannot be empty" }, { status: 400 });
  if (endTime <= startTime) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }

  db.prepare(
    `UPDATE overlays SET text = ?, start_time = ?, end_time = ?, position = ?, font_size = ?, color = ?
     WHERE id = ?`
  ).run(text, startTime, endTime, position, fontSize, color, overlayId);

  const updated = db.prepare("SELECT * FROM overlays WHERE id = ?").get(overlayId) as Overlay;
  return NextResponse.json({ overlay: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; overlayId: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id, overlayId } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  db.prepare("DELETE FROM overlays WHERE id = ? AND project_id = ?").run(overlayId, id);

  return NextResponse.json({ ok: true });
}
