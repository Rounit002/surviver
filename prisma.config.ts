import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads .env automatically. Node 22 can do it natively.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file present; rely on the ambient environment instead.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
    // Only `prisma migrate dev` needs a shadow database, and only the local
    // Postgres needs it named explicitly (its template1 has a damaged page, so
    // Prisma cannot create one on the fly). `migrate deploy` on the hosted
    // database never uses it, so this stays optional — requiring it here would
    // fail `prisma generate` during the production build.
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: env("SHADOW_DATABASE_URL") }
      : {}),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
