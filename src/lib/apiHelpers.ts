import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { getDb } from "./db";
import type { Project } from "./types";

export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
