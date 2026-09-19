const production = process.env.NODE_ENV === "production";
if (!production) process.exit(0);

const failures = [];
const requireStrong = (name) => {
  const value = process.env[name] ?? "";
  if (Buffer.byteLength(value) < 32 || /change-me|surviver-dev/i.test(value)) {
    failures.push(`${name} must be a unique secret of at least 32 bytes`);
  }
};

requireStrong("SECURITY_SECRET");
requireStrong("IP_HASH_SALT");
requireStrong("CRON_SECRET");

let appUrl;
try { appUrl = new URL(process.env.APP_URL ?? ""); } catch { failures.push("APP_URL must be an absolute URL"); }
if (appUrl?.protocol !== "https:") failures.push("APP_URL must use HTTPS in production");
if (appUrl && (appUrl.hostname !== "surviver.lol" || appUrl.pathname !== "/" || appUrl.search || appUrl.hash || appUrl.port)) {
  failures.push("APP_URL must be the canonical origin https://surviver.lol");
}
if (process.env.PAYMENT_PROVIDER !== "dodo") failures.push("PAYMENT_PROVIDER must be dodo in production");
if (process.env.DODO_PAYMENTS_ENVIRONMENT !== "live_mode") failures.push("DODO_PAYMENTS_ENVIRONMENT must be live_mode in production");
for (const name of ["DATABASE_URL", "DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY", "DODO_PAYMENTS_PRODUCT_ID", "DODO_PAYMENTS_BUSINESS_ID"]) {
  if (!process.env[name]) failures.push(`${name} is required in production`);
}

if (failures.length) {
  console.error(`Unsafe production configuration:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
