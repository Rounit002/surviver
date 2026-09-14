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

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const isSecure = request.nextUrl.protocol === "https:";
  const base = {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
  } as const;

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, newId(), { ...base, maxAge: VISITOR_MAX_AGE });
  }

  // Refreshed on every request so an active browse stays one session.
  response.cookies.set(
    SESSION_COOKIE,
    request.cookies.get(SESSION_COOKIE)?.value ?? newId(),
    { ...base, maxAge: SESSION_MAX_AGE },
  );

  // A Rally landing stamps the referring entry for the rest of the visit.
  const rally = request.nextUrl.searchParams.get("rally");
  if (rally && /^[a-z0-9-]{1,40}$/i.test(rally)) {
    response.cookies.set(RALLY_COOKIE, rally, { ...base, maxAge: SESSION_MAX_AGE });
  }

  return response;
}

export const config = {
  // Skip static assets and image optimisation; they are not visitor events.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
