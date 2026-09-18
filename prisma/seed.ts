/**
 * Baseline seed: Season 0, open for registration.
 *
 * Run with:  npm run db:seed
 * Demo contestants live in prisma/seed-demo.ts so this stays safe to run
 * against an environment that already has real entries.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

try {
  process.loadEnvFile(".env");
} catch {
  // Ambient environment only.
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  // The site has no administrator surface, so this seed provisions no
  // privileged account. The ADMIN role survives in the schema for the existing
  // audit rows; nothing in the application reads it.

  const season = await prisma.season.upsert({
    where: { number: 0 },
    update: {},
    create: {
      number: 0,
      name: "Season 0",
      status: "REGISTRATION_OPEN",
      entryPriceCents: 2900,
      currency: "usd",
      capacity: 32,
      registrationStart: new Date(),
      registrationEnd: new Date(Date.now() + 14 * DAY_MS),
    },
  });

  console.log(
    `Season ${season.number}: ${season.status}, capacity ${season.capacity}, ` +
      `entry ${(season.entryPriceCents / 100).toFixed(2)} ${season.currency.toUpperCase()}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
