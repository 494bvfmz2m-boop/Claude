import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireSession, isResponse } from "@/lib/apiHelpers";
import type { Project } from "@/lib/types";

export async function GET() {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const db = getDb();
  const projects = db
    .prepare("SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC")
    .all(session.userId) as Project[];

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, owner_id, name, resolution_w, resolution_h, created_at, updated_at)
     VALUES (?, ?, ?, 1920, 1080, ?, ?)`
  ).run(id, session.userId, name, now, now);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
  return NextResponse.json({ project }, { status: 201 });
}
