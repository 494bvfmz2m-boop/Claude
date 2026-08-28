import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSessionToken, setSessionCookie } from "@/lib/auth";

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
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, username: session.username });
}
