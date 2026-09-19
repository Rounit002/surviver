import { env } from "@/lib/env";

/** A reverse proxy's internal request URL is never the public origin. */
export function publicUrl(path: string): URL {
  const origin = new URL(env.appUrl).origin;
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new Error("External application redirect");
  return url;
}

export function isSameOrigin(request: Request): boolean {
  return request.headers.get("origin") === new URL(env.appUrl).origin;
}
