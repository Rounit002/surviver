/**
 * Baseline seed: one administrator and Season 0 open for registration.
 *
 * Run with:  npm run db:seed
 * Demo contestants live in prisma/seed-demo.ts so this stays safe to run
 * against an environment that already has real entries.
 */

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
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
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@surviver.lol";
  const generated = randomBytes(9).toString("base64url");
  const password = process.env.SEED_ADMIN_PASSWORD ?? generated;

  const existing = await prisma.user.findUnique({ where: { email } });

  const admin = existing
    ? await prisma.user.update({ where: { email }, data: { role: "ADMIN" } })
    : await prisma.user.create({
        data: {
          email,
          name: "Surviver Admin",
          role: "ADMIN",
          passwordHash: await bcrypt.hash(password, 12),
        },
      });

  console.log(`Admin: ${admin.email}`);
  console.log(
    existing
      ? "  (existing user promoted to ADMIN; password unchanged)"
      : `  password: ${password}`,
  );

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
