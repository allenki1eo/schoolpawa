import { and, asc, eq, ilike } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { route } from "@/server/http";

/**
 * Public, anonymous lookups for onboarding (no personal data involved):
 *   ?          → regions
 *   ?region=   → districts
 *   ?district= → schools (optional &q= search)
 *   ?stage=    → grade levels
 */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const region = url.searchParams.get("region");
  const district = url.searchParams.get("district");
  const stage = url.searchParams.get("stage");
  const q = url.searchParams.get("q")?.trim().slice(0, 40);

  if (stage === "primary" || stage === "secondary") {
    return {
      grades: await db
        .select()
        .from(schema.gradeLevels)
        .where(and(eq(schema.gradeLevels.stage, stage), eq(schema.gradeLevels.active, true)))
        .orderBy(asc(schema.gradeLevels.ordinal)),
    };
  }
  if (district) {
    const where = [eq(schema.schools.districtId, district), eq(schema.schools.active, true)];
    if (q) where.push(ilike(schema.schools.name, `%${q.replace(/[%_]/g, "")}%`));
    return {
      schools: await db
        .select({ id: schema.schools.id, name: schema.schools.name, regNo: schema.schools.regNo, stage: schema.schools.stage })
        .from(schema.schools)
        .where(and(...where))
        .orderBy(asc(schema.schools.name))
        .limit(60),
    };
  }
  if (region) {
    return { districts: await db.select().from(schema.districts).where(eq(schema.districts.regionId, region)).orderBy(asc(schema.districts.name)) };
  }
  return { regions: await db.select().from(schema.regions).orderBy(asc(schema.regions.name)) };
});
