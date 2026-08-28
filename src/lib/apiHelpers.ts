import { NextResponse } from "next/server";
import { getSession, clearSessionCookie, type Session } from "./auth";
import { getDb } from "./db";
import type { Project } from "./types";

export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The JWT itself can still be validly signed after the user row it points
  // at is gone — e.g. the data volume wasn't persisted across a redeploy, so
  // the app reseeded fresh accounts with new ids on boot, but the browser
  // still holds an old, signed cookie for the previous instance. Writes that
  // reference session.userId as a foreign key (projects.owner_id) would then
  // fail with a raw DB error instead of a clean "please log in again".
  const db = getDb();
  const userExists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(session.userId);
  if (!userExists) {
    await clearSessionCookie();
    return NextResponse.json(
      { error: "Your session is no longer valid — please log in again." },
      { status: 401 }
    );
  }

  return session;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export function getOwnedProject(projectId: string, userId: string): Project | null {
  const db = getDb();
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ?")
    .get(projectId, userId) as Project | undefined;
  return project ?? null;
}
