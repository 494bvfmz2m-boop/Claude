import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSessionToken, setSessionCookie } from "@/lib/auth";

function isSecureRequest(req: NextRequest): boolean {
  // Behind a reverse proxy (Coolify/Traefik) that terminates TLS, the app
  // itself only ever sees a plain HTTP connection — the proxy tells us the
  // original protocol via this header instead.
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
  }

  const session = authenticate(body.username, body.password);
  if (!session) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = await createSessionToken(session);
  await setSessionCookie(token, isSecureRequest(req));

  return NextResponse.json({ ok: true, username: session.username });
}
