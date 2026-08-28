import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import type { Overlay } from "@/lib/types";

const VALID_POSITIONS = new Set(["top", "center", "bottom"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const startTime = typeof body?.startTime === "number" ? body.startTime : null;
  const endTime = typeof body?.endTime === "number" ? body.endTime : null;
  const position = VALID_POSITIONS.has(body?.position) ? body.position : "bottom";
  const fontSize = typeof body?.fontSize === "number" ? body.fontSize : 48;
  const color = typeof body?.color === "string" ? body.color : "#ffffff";

  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (startTime === null || endTime === null || endTime <= startTime) {
    return NextResponse.json(
      { error: "startTime and endTime are required, and endTime must be after startTime" },
      { status: 400 }
    );
  }

  const db = getDb();
  const overlayId = randomUUID();
  db.prepare(
    `INSERT INTO overlays (id, project_id, text, start_time, end_time, position, font_size, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(overlayId, id, text, startTime, endTime, position, fontSize, color);

  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);

  const overlay = db.prepare("SELECT * FROM overlays WHERE id = ?").get(overlayId) as Overlay;
  return NextResponse.json({ overlay }, { status: 201 });
}
