import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getDb } from "@/lib/db";
import { requireSession, isResponse } from "@/lib/apiHelpers";
import { UPLOADS_DIR } from "@/lib/paths";
import { serveFile } from "@/lib/serveFile";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
};

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
      `SELECT media.id FROM media
       JOIN projects ON projects.id = media.project_id
       WHERE media.filename = ? AND projects.owner_id = ?`
    )
    .get(safeName, session.userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = path.extname(safeName).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  return serveFile(req, path.join(UPLOADS_DIR, safeName), contentType);
}
