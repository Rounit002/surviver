import "server-only";

import { isIP } from "node:net";
import { fetchPublicPage, isPublicAddress, UnsafeUrlError } from "@/lib/security/public-fetch";
export { UnsafeUrlError } from "@/lib/security/public-fetch";

/**
 * Fetches a submitted product URL so the entry form can prefill itself.
 *
 * Only http(s) URLs on standard web ports are accepted. Redirects are followed
 * manually, with a hard timeout and a capped response body.
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
  const bareHostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(bareHostname) && !isPublicAddress(bareHostname)) {
    throw new UnsafeUrlError("Enter a publicly accessible website.");
  }
  if (!url.hostname.includes(".") && isIP(bareHostname) === 0) {
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
    let response: Awaited<ReturnType<typeof fetchPublicPage>>;
    try {
      response = await fetchPublicPage(url, remaining, MAX_BYTES);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw error;
      return { url: current, title: null, description: null, imageUrl: null, faviconUrl: null };
    }

    // Follow redirects by hand so each new host is validated too.
    if (response.status >= 300 && response.status < 400) {
      const location = response.location;
      if (!location) break;
      if (hop === MAX_REDIRECTS) throw new UnsafeUrlError("The site redirected too many times.");
      current = normalizeUrl(new URL(location, current).toString());
      continue;
    }

    html = response.html;
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
