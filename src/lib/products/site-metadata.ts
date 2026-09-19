import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Pool, fetch as pinnedFetch } from "undici";

/**
 * Fetches a submitted product URL so the entry form can prefill itself.
 *
 * This is the one place the server makes a request to an address a stranger
 * chose, so it is treated as hostile: only http(s), only public IP addresses,
 * redirects re-validated by hand, a hard timeout, and a capped read. Without
 * that, "fetch my details" becomes an SSRF probe into whatever the app can
 * reach on its own network.
 */

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;

export type SiteMetadata = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
};

export class UnsafeUrlError extends Error {}

/** Accepts what a founder would paste and returns a canonical absolute URL. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new UnsafeUrlError("Enter your product URL.");

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("That does not look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https addresses are allowed.");
  }
  if (!url.hostname.includes(".")) {
    throw new UnsafeUrlError("Enter a full domain, for example yourproduct.com.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Remove the credentials from the URL.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Only standard web ports are allowed.");
  }

  url.hash = "";
  return url.toString();
}

export function isPrivateAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    } else if (parsed.kind() === "ipv6" && parsed.range() === "rfc6052") {
      const translated = parsed as ipaddr.IPv6;
      // Some networks use DNS64/NAT64 and synthesize public IPv4 destinations
      // under the well-known /96 prefix. Check the embedded IPv4 address just
      // like an ordinary A record; reject the local-use translation prefix.
      if (!translated.match(ipaddr.parse("64:ff9b::"), 96)) return true;
      const [high, low] = translated.parts.slice(-2);
      parsed = new ipaddr.IPv4([high! >> 8, high! & 0xff, low! >> 8, low! & 0xff]);
    }
    return parsed.range() !== "unicast";
  } catch {
    return true;
  }
}

/** Rejects hosts that resolve anywhere inside the private network. */
async function assertPublicHost(hostname: string, timeoutMs: number): Promise<{ address: string; family: 4 | 6 }> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError("That address is not reachable from the public internet.");
    }
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await Promise.race([
      lookup(hostname, { all: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), timeoutMs)),
    ]);
  } catch {
    throw new UnsafeUrlError("We could not resolve that domain.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("We could not resolve that domain.");
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new UnsafeUrlError("That address is not reachable from the public internet.");
    }
  }
  const selected = addresses[0]!;
  return { address: selected.address, family: selected.family as 4 | 6 };
}

/**
 * Reads at most MAX_BYTES of the body, so a huge response cannot exhaust
 * memory. Copying is bounded per chunk: a hostile server that answers with one
 * enormous chunk must not get that whole chunk buffered before it is sliced.
 */
async function readCapped(response: Awaited<ReturnType<typeof pinnedFetch>>): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const buffer = new Uint8Array(MAX_BYTES);
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, MAX_BYTES - total);
      buffer.set(value.subarray(0, take), total);
      total += take;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(buffer.subarray(0, total));
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ");
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = decodeEntities(match[1]).trim().replace(/\s+/g, " ");
      if (value) return value;
    }
  }
  return null;
}

/**
 * Best effort. A site that blocks bots or has no metadata simply returns nulls
 * and the founder fills the fields in by hand.
 */
export async function fetchSiteMetadata(inputUrl: string): Promise<SiteMetadata> {
  let current = normalizeUrl(inputUrl);
  let html = "";
  const deadline = Date.now() + FETCH_TIMEOUT_MS;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(current);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new UnsafeUrlError("The site took too long to respond.");
    const address = await assertPublicHost(url.hostname, remaining);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
    const pool = new Pool(url.origin, { connections: 1, pipelining: 0, connect: {
      lookup(_hostname, _options, callback) { callback(null, address.address, address.family); },
    } });

    let response: Awaited<ReturnType<typeof pinnedFetch>>;
    try {
      response = await pinnedFetch(url, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: pool,
        headers: {
          // Identify honestly; some sites choose to block us, which is fine.
          "user-agent": "SurviverBot/1.0 (+https://surviver.lol)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      clearTimeout(timer);
      await pool.close().catch(() => undefined);
      return { url: current, title: null, description: null, imageUrl: null, faviconUrl: null };
    }

    // Follow redirects by hand so each new host is validated too.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      clearTimeout(timer);
      await pool.close();
      if (!location) break;
      current = normalizeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) {
      await response.body?.cancel().catch(() => undefined);
      clearTimeout(timer);
      await pool.close();
      break;
    }

    try {
      html = await readCapped(response);
    } finally {
      clearTimeout(timer);
      await pool.close().catch(() => undefined);
    }
    break;
  }

  if (!html) {
    return { url: current, title: null, description: null, imageUrl: null, faviconUrl: null };
  }

  const title =
    metaContent(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]) ?? null;

  const description = metaContent(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const rawImage = metaContent(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const absolute = (value: string | null) => {
    if (!value) return null;
    try {
      const resolved = new URL(value, current);
      return resolved.protocol === "https:" || resolved.protocol === "http:"
        ? resolved.toString()
        : null;
    } catch {
      return null;
    }
  };

  return {
    url: current,
    title,
    description,
    imageUrl: absolute(rawImage),
    faviconUrl: absolute(`https://icons.duckduckgo.com/ip3/${new URL(current).hostname}.ico`),
  };
}
