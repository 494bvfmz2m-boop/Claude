import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getDb } from "@/lib/db";
import { requireSession, isResponse } from "@/lib/apiHelpers";
import { RENDERS_DIR } from "@/lib/paths";
import { serveFile } from "@/lib/serveFile";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const { filename } = await params;
  const safeName = path.basename(filename);

  const db = getDb();
  const owned = db
    .prepare(
      `SELECT render_jobs.id FROM render_jobs
       JOIN projects ON projects.id = render_jobs.project_id
       WHERE render_jobs.output_filename = ? AND projects.owner_id = ?`
    )
    .get(safeName, session.userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return serveFile(req, path.join(RENDERS_DIR, safeName), "video/mp4");
}
