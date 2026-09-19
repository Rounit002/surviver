import "server-only";

/**
 * Environment access.
 *
 * Values are read lazily so that a missing variable fails at the point of use
 * with a clear message, rather than crashing the whole build at import time.
 */

function read(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

/** Read live rather than captured: tests and tooling set this at runtime. */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Hostnames that only resolve inside the deployment: a reverse proxy's own
 * listener, a container's loopback, or a bare name with no public DNS.
 */
function isInternalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0" || host === "::") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) return true;
  // A public origin always has a registrable domain; `app`, `web` or a bare
  // container name never does.
  return !host.includes(".");
}

export const env = {
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  /**
   * Public origin, used to build Rally, share and redirect URLs.
   *
   * A reverse proxy hands the app its own internal request origin
   * (`https://localhost:10000` on a typical container host), so every outward
   * URL has to come from here instead. There is no localhost fallback in
   * production: a missing APP_URL must fail loudly rather than quietly send
   * real visitors to an address only the container can reach.
   */
  get appUrl() {
    const raw = read("APP_URL", isProduction() ? undefined : "http://localhost:3000").replace(/\/+$/, "");
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`APP_URL must be an absolute URL such as https://surviver.lol, not ${JSON.stringify(raw)}.`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("APP_URL must use http or https.");
    }
    if (isProduction() && isInternalHost(url.hostname)) {
      throw new Error(
        `APP_URL is set to the internal address ${url.host}. Set it to the public origin, for example https://surviver.lol.`,
      );
    }
    return raw;
  },
  /** Salt for hashing visitor IPs. Never store raw addresses. */
  get ipHashSalt() {
    return read("IP_HASH_SALT", "surviver-dev-salt");
  },
  get securitySecret() {
    return read("SECURITY_SECRET", "surviver-development-security-secret-only");
  },
  get paymentProvider() {
    return read("PAYMENT_PROVIDER", "dev");
  },
  /** Shared secret required by scheduled jobs such as round transitions. */
  get cronSecret() {
    return read("CRON_SECRET", "surviver-dev-cron");
  },
  get isProduction() {
    return isProduction();
  },
  get dodoApiKey() { return read("DODO_PAYMENTS_API_KEY", ""); },
  get dodoWebhookKey() { return read("DODO_PAYMENTS_WEBHOOK_KEY", ""); },
  get dodoProductId() { return read("DODO_PAYMENTS_PRODUCT_ID", ""); },
  get dodoEnvironment() { return read("DODO_PAYMENTS_ENVIRONMENT", "test_mode"); },
  get dodoBusinessId() { return read("DODO_PAYMENTS_BUSINESS_ID", ""); },
};
