import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "clipforge_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Session = { userId: string; username: string };

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET env var must be set to a random string of at least 16 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId === "string" && typeof payload.username === "string") {
      return { userId: payload.userId, username: payload.username };
    }
    return null;
  } catch {
    return null;
  }
}
