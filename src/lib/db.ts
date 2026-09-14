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
};

const databaseUrl = env.databaseUrl;

// Hot reload preserves globalThis even after Next reloads .env. Retire the old
// pool when credentials change so retries do not keep using its old password.
if (!env.isProduction && globalForPrisma.prisma && globalForPrisma.prismaDatabaseUrl !== databaseUrl) {
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
}
