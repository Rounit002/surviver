import { cookies } from "next/headers";
import { HUMAN_COOKIE } from "@/lib/competition/constants";
import { env } from "@/lib/env";
import { isSameOrigin } from "@/lib/security/origin";
import { checkRequestLimit } from "@/lib/security/rate-limit";
import { readLimitedText, requestIp } from "@/lib/security/request";
import { getVisitorContext, HUMAN_PASS_MS, humanPassValue, isScorable } from "@/lib/tracking/visitor";

/**
 * Exchange a Cloudflare Turnstile token for a human pass.
 *
 * The token comes from the invisible check that runs once per visit. It is
 * verified here with Cloudflare (tokens are single-use and live five
 * minutes), and on success the browser gets a signed, visitor-bound cookie
 * that lets its clicks count for the next twelve hours.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (!env.turnstileEnabled) return Response.json({ human: true, enforced: false });

  const limit = await checkRequestLimit("human-check", 30, 10 * 60_000).catch(() => ({ allowed: false }));
  if (!limit.allowed) return new Response(null, { status: 429 });

  const raw = await readLimitedText(request, 4096);
  let token: unknown;
  try {
    token = raw ? (JSON.parse(raw) as { token?: unknown }).token : undefined;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return new Response(null, { status: 400 });

  const visitor = await getVisitorContext();
  if (!isScorable(visitor)) return Response.json({ human: false });

  const body = new URLSearchParams({ secret: env.turnstileSecretKey, response: token });
  const ip = await requestIp();
  if (ip !== "unknown") body.set("remoteip", ip);

  let verdict: { success?: boolean; hostname?: string };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    verdict = (await response.json()) as typeof verdict;
  } catch (error) {
    console.error("[surviver] turnstile verification unavailable", error);
    return Response.json({ human: false }, { status: 503 });
  }

  // In production the token must also have been issued for this site, so a
  // token minted on some other page cannot be carried over.
  if (!verdict.success || (env.isProduction && verdict.hostname && verdict.hostname !== new URL(env.appUrl).hostname)) {
    return Response.json({ human: false });
  }

  (await cookies()).set(HUMAN_COOKIE, humanPassValue(visitor.visitorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: HUMAN_PASS_MS / 1000,
  });
  return Response.json({ human: true });
}
