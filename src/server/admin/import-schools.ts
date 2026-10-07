import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { parseSchoolsCsv } from "@/lib/import/schools-csv";
import { bandMidpoint } from "@/lib/ranking/school-power";

/** Region crest colours (extend as regions are added). */
export const REGION_COLORS: Record<string, string> = {
  SHINYANGA: "#2DD4BF",
  MWANZA: "#60A5FA",
  DODOMA: "#F472B6",
  "DAR ES SALAAM": "#FB923C",
};

const regionCode = (name: string) => name.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

/**
 * Upsert schools from a registry CSV. Idempotent on reg_no; creates regions and districts on
 * first sight. Not marked server-only so the CLI importer can reuse it.
 */
export async function importSchoolsCsv(text: string) {
  const { rows, issues } = parseSchoolsCsv(text);
  let created = 0;
  let updated = 0;
  const regionIds = new Map<string, string>();
  const districtIds = new Map<string, string>();

  for (const row of rows) {
    const regionKey = row.region.trim().toUpperCase();
    let regionId = regionIds.get(regionKey);
    if (!regionId) {
      const code = regionCode(row.region);
      const [r] = await db
        .insert(schema.regions)
        .values({ code, name: row.region.trim(), color: REGION_COLORS[regionKey] ?? "#A78BFA" })
        .onConflictDoUpdate({ target: schema.regions.code, set: { name: row.region.trim() } })
        .returning({ id: schema.regions.id });
      regionId = r!.id;
      regionIds.set(regionKey, regionId);
    }
    const districtKey = `${regionId}:${row.district.toLowerCase()}`;
    let districtId = districtIds.get(districtKey);
    if (!districtId) {
      const [existing] = await db
        .select({ id: schema.districts.id })
        .from(schema.districts)
        .where(and(eq(schema.districts.regionId, regionId), eq(schema.districts.name, row.district)));
      districtId =
        existing?.id ??
        (await db.insert(schema.districts).values({ regionId, name: row.district }).returning({ id: schema.districts.id }))[0]!.id;
      districtIds.set(districtKey, districtId);
    }
    const values = {
      regNo: row.regNo,
      name: row.name,
      districtId,
      stage: row.stage,
      sizeBand: row.sizeBand,
      enrolledEstimate: row.enrolled ?? bandMidpoint(row.sizeBand),
    };
    const [result] = await db
      .insert(schema.schools)
      .values(values)
      .onConflictDoUpdate({ target: schema.schools.regNo, set: { ...values } })
      // xmax = 0 only for freshly inserted rows (Postgres upsert idiom).
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    if (result?.inserted) created++;
    else updated++;
  }
  return { created, updated, issues, total: rows.length };
}
