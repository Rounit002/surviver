import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

  url.hash = "";
  return url.toString();
}

function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts as [number, number];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local, cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier NAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 192 && b === 0) return true;
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  // IPv4-mapped IPv6, e.g. ::ffff:169.254.169.254
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!, 4);
  return false;
}

/** Rejects hosts that resolve anywhere inside the private network. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname, isIP(hostname))) {
      throw new UnsafeUrlError("That address is not reachable from the public internet.");
    }
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("We could not resolve that domain.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("We could not resolve that domain.");
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address, entry.family)) {
      throw new UnsafeUrlError("That address is not reachable from the public internet.");
    }
  }
}

/** Reads at most MAX_BYTES of the body, so a huge response cannot exhaust memory. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);

  return new TextDecoder("utf-8", { fatal: false }).decode(
    Uint8Array.from(chunks.flatMap((c) => Array.from(c))).slice(0, MAX_BYTES),
  );
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

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(current);
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identify honestly; some sites choose to block us, which is fine.
          "user-agent": "SurviverBot/1.0 (+https://surviver.lol)",
          accept: "text/html,application/xhtml+xml",
        },
      });
    } catch {
      return { url: current, title: null, description: null, imageUrl: null, faviconUrl: null };
    } finally {
      clearTimeout(timer);
    }

    // Follow redirects by hand so each new host is validated too.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) break;
    if (!(response.headers.get("content-type") ?? "").includes("html")) break;

    html = await readCapped(response);
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
