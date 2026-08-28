import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, isResponse, getOwnedProject } from "@/lib/apiHelpers";
import { createRenderJob } from "@/lib/render";
import type { RenderJob } from "@/lib/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const clipCount = db
    .prepare("SELECT COUNT(*) as c FROM clips WHERE project_id = ?")
    .get(id) as { c: number };
  if (clipCount.c === 0) {
    return NextResponse.json(
      { error: "Add at least one clip to the timeline before exporting" },
      { status: 400 }
    );
  }

  const jobId = createRenderJob(id);
  const job = db.prepare("SELECT * FROM render_jobs WHERE id = ?").get(jobId) as RenderJob;

  return NextResponse.json({ job }, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const project = getOwnedProject(id, session.userId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const jobs = db
    .prepare("SELECT * FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(id) as RenderJob[];

  return NextResponse.json({ jobs });
}
