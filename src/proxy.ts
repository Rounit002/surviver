import { NextResponse, type NextRequest } from "next/server";
import { RALLY_COOKIE, SESSION_COOKIE, VISITOR_COOKIE } from "@/lib/competition/constants";

/**
 * Assigns anonymous visitor and session identifiers.
 *
 * Scoring needs a stable way to say "the same person saw this card twice"
 * without asking spectators to sign in, which would gut traffic (PRD 31).
 * These are random opaque ids: no personal data, no cross-site value.
 *
 * Next 16 renamed the middleware convention to `proxy`.
 */

const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // one year
const SESSION_MAX_AGE = 60 * 60 * 2; // rolling two hours

function newId() {
  return crypto.randomUUID().replaceAll("-", "");
}

async function signature(value: string): Promise<string> {
  const secret = process.env.SECURITY_SECRET ?? "surviver-development-security-secret-only";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))).toString("base64url");
}

async function signed(value: string): Promise<string> { return `${value}.${await signature(value)}`; }

/** Constant-time string compare; the Edge runtime has no timingSafeEqual. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verified(raw: string | undefined, pattern: RegExp): Promise<string | null> {
  if (!raw || raw.length > 256) return null;
  const split = raw.lastIndexOf(".");
  const value = raw.slice(0, split);
  if (split <= 0 || !pattern.test(value)) return null;
  return constantTimeEqual(await signature(value), raw.slice(split + 1)) ? value : null;
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  if (process.env.NODE_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (request.nextUrl.pathname.startsWith("/entry/") || request.nextUrl.pathname.startsWith("/enter/checkout/")) response.headers.set("Cache-Control", "private, no-store, max-age=0");

  // A TLS-terminating proxy forwards plain HTTP internally, so the request's
  // own protocol is not evidence that the visitor is on HTTP. In production the
  // public origin is HTTPS, so these cookies are always Secure.
  const isSecure = process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:";
  const base = {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
  } as const;

  const visitor = await verified(request.cookies.get(VISITOR_COOKIE)?.value, /^[a-f0-9]{32}$/);
  if (!visitor) response.cookies.set(VISITOR_COOKIE, await signed(newId()), { ...base, maxAge: VISITOR_MAX_AGE });

  // Refreshed on every request so an active browse stays one session.
  response.cookies.set(
    SESSION_COOKIE,
    await signed((await verified(request.cookies.get(SESSION_COOKIE)?.value, /^[a-f0-9]{32}$/)) ?? newId()),
    { ...base, maxAge: SESSION_MAX_AGE },
  );

  // A Rally landing stamps the referring entry for the rest of the visit.
  const rally = request.nextUrl.searchParams.get("rally");
  if (rally && /^[a-z0-9-]{1,40}$/i.test(rally)) {
    response.cookies.set(RALLY_COOKIE, await signed(rally), { ...base, maxAge: SESSION_MAX_AGE });
  }

  return response;
}

export const config = {
  // Skip static assets and image optimisation; they are not visitor events.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
