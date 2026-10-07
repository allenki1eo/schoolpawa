/**
 * Applies hand-written SQL (triggers, functions) that drizzle-kit does not manage.
 * Idempotent: every file must use CREATE OR REPLACE / DROP IF EXISTS.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const dir = join(process.cwd(), "src/db/sql");
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await sql.unsafe(readFileSync(join(dir, file), "utf8"));
  console.log(`applied ${file}`);
}
await sql.end();
