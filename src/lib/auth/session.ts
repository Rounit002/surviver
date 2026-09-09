import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AUTH_COOKIE } from "@/lib/competition/constants";
import type { Role, User } from "@/generated/prisma";

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Refresh the expiry when a session is more than a quarter used up. */
const REFRESH_THRESHOLD_MS = SESSION_TTL_MS * 0.75;

/**
 * The cookie holds a random token; the database stores only its SHA-256. A
 * dump of the sessions table therefore cannot be replayed as a login.
 */
function tokenToId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${env.ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

/** Best-effort client address behind a proxy. Only ever stored hashed. */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      id: tokenToId(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
      ipHash: hashIp(await clientIp()),
    },
  });

  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "avatarUrl" | "xHandle">;

/**
 * Resolves the signed-in user, or null. Expired rows are deleted on sight so
 * the table does not grow without bound.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const id = tokenToId(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, xHandle: true },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry, so an active founder is not logged out mid-season.
  if (session.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    await prisma.session
      .update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } })
      .catch(() => undefined);
  }

  return session.user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: tokenToId(token) } }).catch(() => undefined);
  }
  store.delete(AUTH_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  return user?.role === role;
}
