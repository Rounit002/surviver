import nextEnv from "@next/env";
import pg from "pg";

// Match `next dev` precedence, including .env.local and shell overrides.
nextEnv.loadEnvConfig(process.cwd(), true);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is missing. Set it in .env and run npm run db:check again.");
  process.exitCode = 1;
} else {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query('SELECT 1 FROM "seasons" LIMIT 1');
    console.log("Database authentication and Season table access succeeded.");
  } catch (error) {
    // Never print the connection string or raw driver errors containing secrets.
    const code = typeof error.code === "string" ? error.code : "unknown";
    if (code === "28P01" || code === "28000") {
      console.error("Database authentication failed. Update DATABASE_URL with the current database credentials. Percent-encode special characters in the password, then restart npm run dev.");
    } else if (code === "42P01") {
      console.error("Connected, but the Season table is missing. Apply the project's Prisma migrations to this database.");
    } else {
      console.error(`Database check failed (${code}). Check the connection settings and database availability.`);
    }
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
