import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";

export class UnsafeUrlError extends Error {}

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    // Do not permit mapped IPv4, transition, link-local, private or reserved IPs.
    return parsed.range() === "unicast";
  } catch { return false; }
}

export async function resolvePublicHost(host: string, resolve = lookup) {
  const hostname = host.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolve(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
    throw new UnsafeUrlError("Enter a publicly accessible website, not a private network address.");
  }
  return addresses[0]!;
}

/** Resolve once and pin the connection to that validated address (DNS rebinding safe).
 * Host header and TLS certificate validation still use the original hostname.
 */
export async function fetchPublicPage(url: URL, timeoutMs: number, maxBytes: number) {
  const deadline = Date.now() + timeoutMs;
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const address = await Promise.race([
    resolvePublicHost(url.hostname),
    new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("DNS timeout")), timeoutMs); }),
  ]).finally(() => clearTimeout(dnsTimer));
  return new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      agent: false,
      lookup: (_host, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      headers: { "user-agent": "SurviverBot/1.0 (+https://surviver.lol)", accept: "text/html,application/xhtml+xml", "accept-encoding": "identity" },
    }, response => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status < 200 || status >= 300 || !(response.headers["content-type"] ?? "").includes("html")) {
        response.destroy();
        resolve({ status, location, html: "" });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(new Error("Metadata response too large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, location, html: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    const timer = setTimeout(() => request.destroy(new Error("Metadata timeout")), Math.max(1, deadline - Date.now()));
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end();
  });
}
