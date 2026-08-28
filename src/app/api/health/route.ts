import { NextResponse } from "next/server";

// Unauthenticated on purpose — see PUBLIC_PATHS in src/middleware.ts.
// Coolify (and any other platform health check) hits this to decide when the
// container is ready; it must always return 200 regardless of login state.
export async function GET() {
  return NextResponse.json({ ok: true });
}
