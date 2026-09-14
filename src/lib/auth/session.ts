import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AUTH_COOKIE } from "@/lib/competition/constants";
import { hashIp, requestIp } from "@/lib/security/request";
import type { Role, User } from "@/generated/prisma";

/**
 * Two independent limits (audit F15):
 *
 * - absolute: a session dies this long after sign-in no matter how active it
 *   is, so a copied token cannot be kept alive indefinitely.
 * - idle: a session dies this long after its last use, and slides forward
 *   while it is being used — but never past the absolute limit.
 *
 * Privileged sessions get much shorter windows than ordinary ones.
 */
const FOUNDER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const FOUNDER_IDLE_MS = 24 * 60 * 60 * 1000;
const ADMIN_IDLE_MS = 2 * 60 * 60 * 1000;
/** Only rewrite the idle deadline when it moves by more than this. */
const SLIDE_WRITE_THRESHOLD_MS = 5 * 60 * 1000;

function lifetimesFor(role: Role): { absoluteMs: number; idleMs: number } {
  return role === "ADMIN"
    ? { absoluteMs: ADMIN_SESSION_MS, idleMs: ADMIN_IDLE_MS }
    : { absoluteMs: FOUNDER_SESSION_MS, idleMs: FOUNDER_IDLE_MS };
}

/**
 * The cookie holds a random token; the database stores only its SHA-256. A
 * dump of the sessions table therefore cannot be replayed as a login.
 */
function tokenToId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const h = await headers();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  const { absoluteMs, idleMs } = lifetimesFor(user.role);
  const now = Date.now();
  const absoluteExpiresAt = new Date(now + absoluteMs);
  const expiresAt = new Date(Math.min(now + idleMs, absoluteExpiresAt.getTime()));

  await prisma.session.create({
    data: {
      id: tokenToId(token),
      userId,
      expiresAt,
      absoluteExpiresAt,
      userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
      ipHash: hashIp(await requestIp()),
    },
  });

  const store = await cookies();
  // The cookie may live until the absolute limit; the idle limit is enforced
  // server side, where a stolen cookie cannot influence it.
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    expires: absoluteExpiresAt,
  });
}

export type SessionUser = Pick<User, "id" | "email" | "emailVerifiedAt" | "name" | "role" | "avatarUrl" | "xHandle">;

/**
 * Resolves the signed-in user, or null. Expired rows are deleted on sight so
 * the table does not grow without bound.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const id = tokenToId(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, emailVerifiedAt: true, name: true, role: true, avatarUrl: true, xHandle: true },
      },
    },
  });

  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }

  // Slide the idle deadline forward, never past the absolute one. Written only
  // when it actually moves, so ordinary browsing is not one write per request.
  const { idleMs } = lifetimesFor(session.user.role);
  const slid = Math.min(now + idleMs, session.absoluteExpiresAt.getTime());
  if (slid - session.expiresAt.getTime() > SLIDE_WRITE_THRESHOLD_MS) {
    await prisma.session
      .update({ where: { id }, data: { expiresAt: new Date(slid) } })
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
