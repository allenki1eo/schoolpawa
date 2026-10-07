/** pnpm import:schools -- path/to/schools.csv */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { pg } from "../client";
import { importSchoolsCsv } from "@/server/admin/import-schools";

const file = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (!file) {
  console.error("Usage: pnpm import:schools -- <file.csv>");
  process.exit(1);
}
const result = await importSchoolsCsv(readFileSync(file, "utf8"));
console.log(`created ${result.created}, updated ${result.updated}, rows ${result.total}`);
for (const issue of result.issues) console.warn(`  line ${issue.line}: ${issue.message}`);
await pg.end();
