import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./types";

const COOKIE = "vd_session";
const MAX_AGE = 60 * 60 * 24 * 7; // one week

const globalForSession = globalThis as unknown as { demoSessionKey?: Uint8Array };

function secret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (raw) {
    if (raw.length < 16) throw new Error("SESSION_SECRET is too short. Use 16+ characters.");
    return new TextEncoder().encode(raw);
  }
  // Demo mode needs no configuration. Without a secret, sessions are signed
  // with a random key that lasts as long as the server process — the same
  // lifetime as the virtual data, so a restart signs everyone out and resets
  // the data together. Set SESSION_SECRET to keep sign-ins across restarts.
  if (!globalForSession.demoSessionKey) {
    globalForSession.demoSessionKey = new Uint8Array(randomBytes(32));
    console.warn("SESSION_SECRET is not set; using a random key for this server process.");
  }
  return globalForSession.demoSessionKey;
}

export type SessionPayload = { userId: string; role: Role };

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.userId;
    const role = payload.role;
    if (typeof userId !== "string" || typeof role !== "string") return null;
    return { userId, role: role as Role };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
