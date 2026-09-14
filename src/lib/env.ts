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

export const env = {
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  /** Public origin, used to build Rally and share URLs. */
  get appUrl() {
    return read("APP_URL", "http://localhost:3000").replace(/\/$/, "");
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
    return process.env.NODE_ENV === "production";
  },
  get dodoApiKey() { return read("DODO_PAYMENTS_API_KEY", ""); },
  get dodoWebhookKey() { return read("DODO_PAYMENTS_WEBHOOK_KEY", ""); },
  get dodoProductId() { return read("DODO_PAYMENTS_PRODUCT_ID", ""); },
  get dodoEnvironment() { return read("DODO_PAYMENTS_ENVIRONMENT", "test_mode"); },
  get dodoBusinessId() { return read("DODO_PAYMENTS_BUSINESS_ID", ""); },
  get adminTotpSecret() { return read("ADMIN_TOTP_SECRET", ""); },
  get resendApiKey() { return read("RESEND_API_KEY", ""); },
  get emailFrom() { return read("EMAIL_FROM", ""); },
};
