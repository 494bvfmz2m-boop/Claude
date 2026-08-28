import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  type Session,
} from "./session";

export type { Session };
export { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export function authenticate(username: string, password: string): Session | null {
  const db = getDb();
  const user = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as { id: string; username: string; password_hash: string } | undefined;
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { userId: user.id, username: user.username };
}
