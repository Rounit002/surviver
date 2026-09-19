/** Build a checkout completion redirect from the configured public origin.
 * Never derive this origin from the incoming request: reverse proxies can
 * expose an internal host such as localhost:10000 there.
 */
export function getPaymentCompletionUrl(appUrl: string, token?: string): URL {
  const path = /^[A-Za-z0-9_-]{20,128}$/.test(token ?? "")
    ? `/entry/${token}`
    : "/board";
  return new URL(path, `${appUrl.replace(/\/+$/, "")}/`);
}
