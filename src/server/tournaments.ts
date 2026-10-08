import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { rankSchools, bandMidpoint, type SizeBand, type Stage } from "@/lib/ranking/school-power";
import { audit } from "./audit";
import { config } from "./config";
import type { Admin } from "./admin/auth";

/**
 * School vs School tournaments (PRD §3.3). No separate scoring state: a tournament is a filter
 * over the append-only ledger — counted points from rounds in the theme topics, earned inside
 * the window, by schools in the stage/region — ranked with the same School Power formula.
 */
export type Tournament = typeof schema.tournaments.$inferSelect;

export function tournamentPhase(t: Pick<Tournament, "startsAt" | "endsAt" | "status">, now = new Date()) {
  if (t.status === "cancelled") return "cancelled" as const;
  if (now < t.startsAt) return "upcoming" as const;
  if (now > t.endsAt) return "finished" as const;
  return "live" as const;
}

export async function tournamentsForStudent(stage: Stage, regionId: string) {
  const since = new Date(Date.now() - 14 * 86_400_000);
  return db
    .select()
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.stage, stage),
        eq(schema.tournaments.status, "scheduled"),
        or(isNull(schema.tournaments.regionId), eq(schema.tournaments.regionId, regionId)),
        gte(schema.tournaments.endsAt, since),
      ),
    )
    .orderBy(asc(schema.tournaments.startsAt));
}

export async function liveTournament(stage: Stage, regionId: string) {
  const now = new Date();
  const [t] = await db
    .select()
    .from(schema.tournaments)
    .where(
      and(
        eq(schema.tournaments.stage, stage),
        eq(schema.tournaments.status, "scheduled"),
        or(isNull(schema.tournaments.regionId), eq(schema.tournaments.regionId, regionId)),
        lte(schema.tournaments.startsAt, now),
        gte(schema.tournaments.endsAt, now),
      ),
    )
    .orderBy(desc(schema.tournaments.startsAt))
    .limit(1);
  return t ?? null;
}

export async function tournamentBoard(t: Tournament) {
  const topicIds = t.topicIds.length ? t.topicIds : ["00000000-0000-0000-0000-000000000000"];
  const rows = await db.execute<{
    id: string; name: string; reg_no: string; size_band: SizeBand; enrolled_estimate: number; district_name: string; region_color: string;
    points: string | null; active: string | null;
  }>(sql`
    select sc.id, sc.name, sc.reg_no, sc.size_band, sc.enrolled_estimate, d.name as district_name, r.color as region_color,
           agg.points, agg.active
    from schools sc
    join districts d on d.id = sc.district_id
    join regions r on r.id = d.region_id
    left join (
      select l.school_id, sum(l.amount) as points, count(distinct l.student_id) as active
      from points_ledger l
      join quiz_sessions q on q.id::text = l.ref_id
      where l.status = 'counted'
        and l.created_at between ${t.startsAt.toISOString()} and ${t.endsAt.toISOString()}
        and q.topic_id::text in (${sql.join(topicIds.map((id) => sql`${id}`), sql`, `)})
      group by l.school_id
    ) agg on agg.school_id = sc.id
    where sc.active and sc.stage = ${t.stage} ${t.regionId ? sql`and d.region_id = ${t.regionId}` : sql``}`);
  const stats = rows.map((r) => ({
    schoolId: r.id,
    name: r.name,
    regNo: r.reg_no,
    sizeBand: r.size_band,
    districtName: r.district_name,
    regionColor: r.region_color,
    enrolledEstimate: r.enrolled_estimate || bandMidpoint(r.size_band),
    points: Number(r.points ?? 0),
    activeStudents: Number(r.active ?? 0),
  }));
  const byId = new Map(stats.map((s) => [s.schoolId, s]));
  return rankSchools(stats, stats, config.SCHOOL_POWER_C).map((r) => ({ ...byId.get(r.schoolId)!, ...r }));
}

export async function myTournamentPoints(t: Tournament, studentId: string) {
  const topicIds = t.topicIds.length ? t.topicIds : ["00000000-0000-0000-0000-000000000000"];
  const [row] = await db.execute<{ points: string | null; rounds: string }>(sql`
    select sum(l.amount) as points, count(*) as rounds
    from points_ledger l join quiz_sessions q on q.id::text = l.ref_id
    where l.student_id = ${studentId} and l.status = 'counted'
      and l.created_at between ${t.startsAt.toISOString()} and ${t.endsAt.toISOString()}
      and q.topic_id::text in (${sql.join(topicIds.map((id) => sql`${id}`), sql`, `)})`);
  return { points: Number(row?.points ?? 0), rounds: Number(row?.rounds ?? 0) };
}

export async function createTournament(
  admin: Admin,
  input: { titleSw: string; titleEn: string; stage: Stage; regionId: string | null; topicIds: string[]; startsAt: Date; endsAt: Date },
) {
  if (!(input.endsAt > input.startsAt)) throw new Error("End must be after start.");
  if (input.topicIds.length === 0) throw new Error("Pick at least one topic.");
  const [t] = await db.insert(schema.tournaments).values({ ...input, createdBy: admin.id }).returning({ id: schema.tournaments.id });
  await audit({ actorType: "admin", actorId: admin.id, action: "tournament.create", targetType: "tournament", targetId: t!.id });
  return t!.id;
}

export async function cancelTournament(admin: Admin, id: string) {
  await db.update(schema.tournaments).set({ status: "cancelled" }).where(eq(schema.tournaments.id, id));
  await audit({ actorType: "admin", actorId: admin.id, action: "tournament.cancel", targetType: "tournament", targetId: id });
}
