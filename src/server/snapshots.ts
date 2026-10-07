import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { rankSchools } from "@/lib/ranking/school-power";
import { addDays, weekStart } from "@/lib/time";
import { audit } from "./audit";
import { config } from "./config";
import { schoolStats } from "./leaderboard";

/**
 * Freeze the previous week's School Power rankings. Snapshots are aggregate (school-level) and
 * contain no child data, so they survive individual erasure requests.
 */
export async function snapshotWeek(week = addDays(weekStart(), -7)) {
  const existing = await db
    .select({ id: schema.rankingSnapshots.id })
    .from(schema.rankingSnapshots)
    .where(and(eq(schema.rankingSnapshots.scope, "school"), eq(schema.rankingSnapshots.periodStart, week)))
    .limit(1);
  if (existing.length) return { week, written: 0, skipped: true };

  const stats = await schoolStats(week);
  const rows: (typeof schema.rankingSnapshots.$inferInsert)[] = [];
  for (const stage of ["primary", "secondary"] as const) {
    const population = stats.filter((s) => s.stage === stage);
    const leagues = new Map<string, typeof population>();
    for (const s of population) {
      for (const key of [`${stage}:all:national`, `${stage}:${s.sizeBand}:national`, `${stage}:all:region:${s.regionCode}`]) {
        leagues.set(key, [...(leagues.get(key) ?? []), s]);
      }
    }
    for (const [league, members] of leagues) {
      for (const r of rankSchools(members, population, config.SCHOOL_POWER_C)) {
        rows.push({
          scope: "school",
          period: "weekly",
          periodStart: week,
          league,
          entityId: r.schoolId,
          rank: r.rank,
          score: r.power,
          meta: { points: r.points, active: r.activeStudents, bayes: r.bayes, bonus: r.participationBonus },
        });
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) await db.insert(schema.rankingSnapshots).values(rows.slice(i, i + 500));
  await audit({ actorType: "system", action: "rankings.snapshot", meta: { week, rows: rows.length } });
  return { week, written: rows.length, skipped: false };
}
