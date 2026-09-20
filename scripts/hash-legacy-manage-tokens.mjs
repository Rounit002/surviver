import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to migrate legacy campaign capabilities.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  let migrated = 0;
  while (true) {
    const rows = await prisma.$queryRaw`
      SELECT "id", "manageToken"
      FROM "season_entries"
      WHERE "manageToken" IS NOT NULL
        AND "manageToken" !~ '^[a-f0-9]{64}$'
      ORDER BY "id"
      LIMIT 500
    `;
    if (rows.length === 0) break;

    for (const row of rows) {
      const tokenHash = createHash("sha256").update(row.manageToken).digest("hex");
      const result = await prisma.seasonEntry.updateMany({
        where: { id: row.id, manageToken: row.manageToken },
        data: { manageToken: tokenHash },
      });
      migrated += result.count;
    }
  }

  console.log(`Hashed ${migrated} legacy campaign capabilities.`);
} finally {
  await prisma.$disconnect();
}
