import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSession, isResponse } from "@/lib/apiHelpers";
import type { RenderJob } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { id } = await params;
  const db = getDb();
  const job = db
    .prepare(
      `SELECT render_jobs.* FROM render_jobs
       JOIN projects ON projects.id = render_jobs.project_id
       WHERE render_jobs.id = ? AND projects.owner_id = ?`
    )
    .get(id, session.userId) as RenderJob | undefined;

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ job });
}
