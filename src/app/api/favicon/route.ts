/**
 * A same-origin copy of a product's icon, so the page can read its pixels.
 *
 * The board shows icons straight from DuckDuckGo's icon service, which sends no
 * CORS headers, so a canvas that draws one is tainted and its colours cannot be
 * read. This route fetches the same icon on the server and serves it from our
 * own origin. It only ever talks to that one fixed service — the host is a
 * path segment of a fixed URL, never a URL of its own — so it cannot be pointed
 * at anything else, and entrants still never see a viewer's IP address.
 */
const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const MAX_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("host") ?? "";
  if (!HOST.test(host)) return new Response(null, { status: 400 });

  const upstream = await fetch(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host.toLowerCase())}.ico`, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new Response(null, { status: 404 });

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response(null, { status: 413 });

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
