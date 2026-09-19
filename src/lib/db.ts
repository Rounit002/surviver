import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";

// Next dev reloads modules on every edit. Without caching the client on
// globalThis each reload opens a fresh connection pool until Postgres refuses
// new connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDatabaseUrl: string | undefined;
  prismaCtor: unknown;
};

const databaseUrl = env.databaseUrl;

// Hot reload preserves globalThis even after Next reloads .env, so the cached
// client outlives the things it was built from. Retire it when either changes:
//
//   - the URL, so retries do not keep using an old password; and
//   - the generated client itself, because `prisma generate` writes a new
//     module and the cached instance keeps the old one's model delegates. A
//     model added to the schema is then missing from a running dev server, and
//     every query against it fails until the server is restarted — which looks
//     like a broken feature rather than a stale process.
const generatedClientChanged =
  globalForPrisma.prismaCtor !== undefined && globalForPrisma.prismaCtor !== PrismaClient;

if (
  !env.isProduction &&
  globalForPrisma.prisma &&
  (globalForPrisma.prismaDatabaseUrl !== databaseUrl || generatedClientChanged)
) {
  void globalForPrisma.prisma.$disconnect().catch(() => {
    console.warn("[surviver] Could not close the previous development database pool.");
  });
  globalForPrisma.prisma = undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({
    adapter,
    log: env.isProduction ? ["error"] : ["error", "warn"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatabaseUrl = databaseUrl;
  globalForPrisma.prismaCtor = PrismaClient;
}
