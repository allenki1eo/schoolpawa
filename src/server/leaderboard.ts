import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { mostImprovedSchools, mostImprovedStudents } from "@/lib/ranking/improvement";
import { bandMidpoint, rankSchools, schoolPower, populationMean, type SchoolPeriodStats, type SizeBand, type Stage } from "@/lib/ranking/school-power";
import { addDays, weekStart } from "@/lib/time";
import { config } from "./config";
import { kv } from "./kv";

/**
 * Student leaderboards live in Redis sorted sets (fast rank lookups for every profile view);
 * the Postgres ledger is the source of truth and `rebuildStudentBoards()` restores the cache.
 * School Power is computed from the ledger with the pure formula and cached briefly.
 */

export type BoardScope = "class" | "school" | "district" | "region" | "national";
export type Period = "weekly" | "all";

const WEEK_TTL = 60 * 60 * 24 * 7 * 5;

export interface StudentPlace {
  studentId: string;
  schoolId: string;
  districtId: string;
  regionId: string;
  gradeLevelId: string;
}

export function boardKey(period: Period, scope: BoardScope, p: Omit<StudentPlace, "studentId">, week = weekStart()) {
  const prefix = period === "weekly" ? `lb:w:${week}` : "lb:all";
  switch (scope) {
    case "class":
      return `${prefix}:class:${p.schoolId}:${p.gradeLevelId}`;
    case "school":
      return `${prefix}:school:${p.schoolId}`;
    case "district":
      return `${prefix}:district:${p.districtId}:${p.gradeLevelId}`;
    case "region":
      return `${prefix}:region:${p.regionId}:${p.gradeLevelId}`;
    case "national":
      return `${prefix}:national:${p.gradeLevelId}`;
  }
}

const SCOPES: BoardScope[] = ["class", "school", "district", "region", "national"];

export async function placeOf(studentId: string): Promise<StudentPlace | null> {
  const [row] = await db
    .select({
      studentId: schema.students.id,
      schoolId: schema.students.schoolId,
      gradeLevelId: schema.students.gradeLevelId,
      districtId: schema.schools.districtId,
      regionId: schema.districts.regionId,
    })
    .from(schema.students)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.students.schoolId))
    .innerJoin(schema.districts, eq(schema.districts.id, schema.schools.districtId))
    .where(eq(schema.students.id, studentId));
  return row ?? null;
}

/** Called after a `counted` ledger entry commits. */
export async function bumpStudentBoards(place: StudentPlace, amount: number, week: string) {
  await Promise.all(
    SCOPES.flatMap((scope) => [
      kv.zincrby(boardKey("weekly", scope, place, week), amount, place.studentId, WEEK_TTL),
      kv.zincrby(boardKey("all", scope, place), amount, place.studentId),
    ]),
  );
  await kv.del(`sp:cache:${week}`);
}

export interface BoardRow {
  rank: number;
  studentId: string;
  nickname: string;
  discriminator: number;
  avatar: string;
  schoolName: string;
  score: number;
}

export async function studentBoard(period: Period, scope: BoardScope, place: Omit<StudentPlace, "studentId">, limit = 50) {
  const key = boardKey(period, scope, place);
  const top = await kv.zrevrange(key, 0, limit - 1);
  if (top.length === 0) return [];
  const ids = top.map((t) => t.member);
  const people = await db
    .select({
      id: schema.students.id,
      nickname: schema.students.nickname,
      discriminator: schema.students.discriminator,
      avatar: schema.students.avatar,
      schoolName: schema.schools.name,
    })
    .from(schema.students)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.students.schoolId))
    .where(inArray(schema.students.id, ids));
  const byId = new Map(people.map((p) => [p.id, p]));
  let rank = 0;
  let prev: number | undefined;
  return top
    .filter((t) => byId.has(t.member)) // erased students drop out immediately
    .map((t, i): BoardRow => {
      if (t.score !== prev) {
        rank = i + 1;
        prev = t.score;
      }
      const p = byId.get(t.member)!;
      return { rank, studentId: p.id, nickname: p.nickname, discriminator: p.discriminator, avatar: p.avatar, schoolName: p.schoolName, score: t.score };
    });
}

export async function studentRank(period: Period, scope: BoardScope, place: StudentPlace) {
  const key = boardKey(period, scope, place);
  const [rank, score, total] = await Promise.all([kv.zrevrank(key, place.studentId), kv.zscore(key, place.studentId), kv.zcard(key)]);
  return { rank: rank === null ? null : rank + 1, score: score ?? 0, total };
}

/** Rebuild every student board from the ledger (after a Redis flush, or nightly). */
export async function rebuildStudentBoards() {
  const week = weekStart();
  const rows = await db.execute<{
    student_id: string; school_id: string; grade_level_id: string; district_id: string; region_id: string; all_pts: string; week_pts: string;
  }>(sql`
    select l.student_id, s.school_id, s.grade_level_id, sc.district_id, d.region_id,
           sum(l.amount) as all_pts,
           sum(case when l.week_start = ${week} then l.amount else 0 end) as week_pts
    from points_ledger l
    join students s on s.id = l.student_id
    join schools sc on sc.id = s.school_id
    join districts d on d.id = sc.district_id
    where l.status = 'counted'
    group by 1, 2, 3, 4, 5`);
  const keys = new Set<string>();
  for (const r of rows) {
    const place = { studentId: r.student_id, schoolId: r.school_id, gradeLevelId: r.grade_level_id, districtId: r.district_id, regionId: r.region_id };
    for (const scope of SCOPES) {
      keys.add(boardKey("all", scope, place));
      keys.add(boardKey("weekly", scope, place, week));
    }
  }
  await Promise.all([...keys].map((k) => kv.del(k)));
  for (const r of rows) {
    const place = { studentId: r.student_id, schoolId: r.school_id, gradeLevelId: r.grade_level_id, districtId: r.district_id, regionId: r.region_id };
    for (const scope of SCOPES) {
      await kv.zincrby(boardKey("all", scope, place), Number(r.all_pts), r.student_id);
      if (Number(r.week_pts) > 0) await kv.zincrby(boardKey("weekly", scope, place, week), Number(r.week_pts), r.student_id, WEEK_TTL);
    }
  }
  return { students: rows.length };
}

// ─── School Power ───────────────────────────────────────────────────────────────────────────

export interface SchoolStatsRow extends SchoolPeriodStats {
  name: string;
  regNo: string;
  stage: Stage;
  sizeBand: SizeBand;
  districtId: string;
  districtName: string;
  regionId: string;
  regionCode: string;
  regionColor: string;
}

/** Per-school aggregates for one week (or all time when `week` is null). */
export async function schoolStats(week: string | null): Promise<SchoolStatsRow[]> {
  const rows = await db.execute<{
    id: string; name: string; reg_no: string; stage: Stage; size_band: SizeBand; enrolled_estimate: number;
    district_id: string; district_name: string; region_id: string; region_code: string; region_color: string;
    points: string | null; active: string | null;
  }>(sql`
    select sc.id, sc.name, sc.reg_no, sc.stage, sc.size_band, sc.enrolled_estimate,
           sc.district_id, d.name as district_name, d.region_id, r.code as region_code, r.color as region_color,
           agg.points, agg.active
    from schools sc
    join districts d on d.id = sc.district_id
    join regions r on r.id = d.region_id
    left join (
      select school_id, sum(amount) as points, count(distinct student_id) as active
      from points_ledger
      where status = 'counted' ${week ? sql`and week_start = ${week}` : sql``}
      group by school_id
    ) agg on agg.school_id = sc.id
    where sc.active`);
  return rows.map((r) => ({
    schoolId: r.id,
    name: r.name,
    regNo: r.reg_no,
    stage: r.stage,
    sizeBand: r.size_band,
    enrolledEstimate: r.enrolled_estimate || bandMidpoint(r.size_band),
    districtId: r.district_id,
    districtName: r.district_name,
    regionId: r.region_id,
    regionCode: r.region_code,
    regionColor: r.region_color,
    points: Number(r.points ?? 0),
    activeStudents: Number(r.active ?? 0),
  }));
}

export interface SchoolBoardFilter {
  stage: Stage;
  period: Period;
  sizeBand?: SizeBand | "all";
  regionId?: string | "all";
}

export async function schoolBoard(filter: SchoolBoardFilter) {
  const week = filter.period === "weekly" ? weekStart() : null;
  const cacheKey = `sp:cache:${week ?? "all"}`;
  let stats: SchoolStatsRow[];
  const cached = await kv.get(cacheKey);
  if (cached) stats = JSON.parse(cached) as SchoolStatsRow[];
  else {
    stats = await schoolStats(week);
    await kv.set(cacheKey, JSON.stringify(stats), 120);
  }
  // The prior `m` always comes from the whole stage nationally, whatever the filter.
  const population = stats.filter((s) => s.stage === filter.stage);
  const league = population.filter(
    (s) =>
      (!filter.sizeBand || filter.sizeBand === "all" || s.sizeBand === filter.sizeBand) &&
      (!filter.regionId || filter.regionId === "all" || s.regionId === filter.regionId),
  );
  const ranked = rankSchools(league, population, config.SCHOOL_POWER_C);
  const byId = new Map(league.map((s) => [s.schoolId, s]));
  return {
    mean: populationMean(population),
    rows: ranked.map((r) => ({ ...byId.get(r.schoolId)!, ...r })),
  };
}

/** Weekly awards for the PRD's improvement rewards (current week vs previous week). */
export async function improvementAwards(stage: Stage) {
  const thisWeek = weekStart();
  const lastWeek = addDays(thisWeek, -7);

  const studentRows = await db.execute<{ student_id: string; this_xp: string; last_xp: string; this_rounds: string; last_rounds: string }>(sql`
    select s.id as student_id,
      coalesce(sum(case when l.week_start = ${thisWeek} then l.amount end), 0) as this_xp,
      coalesce(sum(case when l.week_start = ${lastWeek} then l.amount end), 0) as last_xp,
      (select count(*) from quiz_sessions q where q.student_id = s.id and q.status = 'completed'
         and q.finished_at >= ${thisWeek}::date - interval '3 hours') as this_rounds,
      (select count(*) from quiz_sessions q where q.student_id = s.id and q.status = 'completed'
         and q.finished_at >= ${lastWeek}::date - interval '3 hours' and q.finished_at < ${thisWeek}::date - interval '3 hours') as last_rounds
    from students s
    join grade_levels g on g.id = s.grade_level_id and g.stage = ${stage}
    join points_ledger l on l.student_id = s.id and l.status = 'counted' and l.week_start in (${thisWeek}, ${lastWeek})
    group by s.id`);
  const students = mostImprovedStudents(
    studentRows.map((r) => ({
      studentId: r.student_id,
      thisWeekXp: Number(r.this_xp),
      lastWeekXp: Number(r.last_xp),
      thisWeekRounds: Number(r.this_rounds),
      lastWeekRounds: Number(r.last_rounds),
    })),
    1,
  );

  const [now, prev] = await Promise.all([schoolStats(thisWeek), schoolStats(lastWeek)]);
  const nowStage = now.filter((s) => s.stage === stage);
  const prevStage = prev.filter((s) => s.stage === stage);
  const mNow = populationMean(nowStage);
  const mPrev = populationMean(prevStage);
  const prevById = new Map(prevStage.map((s) => [s.schoolId, s]));
  const schools = mostImprovedSchools(
    nowStage.map((s) => {
      const p = prevById.get(s.schoolId);
      return {
        schoolId: s.schoolId,
        powerNow: schoolPower(s, mNow, config.SCHOOL_POWER_C).power,
        powerPrev: p ? schoolPower(p, mPrev, config.SCHOOL_POWER_C).power : 0,
        activeNow: s.activeStudents,
        activePrev: p?.activeStudents ?? 0,
      };
    }),
    mNow,
    1,
  );

  const topStudent = students[0]
    ? (await db
        .select({ nickname: schema.students.nickname, discriminator: schema.students.discriminator, avatar: schema.students.avatar })
        .from(schema.students)
        .where(eq(schema.students.id, students[0].studentId)))[0]
    : undefined;
  const topSchool = schools[0] ? nowStage.find((s) => s.schoolId === schools[0]!.schoolId) : undefined;

  return {
    student: topStudent && students[0] ? { ...topStudent, gain: students[0].gain } : null,
    school: topSchool && schools[0] ? { name: topSchool.name, regNo: topSchool.regNo, regionColor: topSchool.regionColor, gain: schools[0].gain } : null,
  };
}

/** Group leaderboard: members' counted points (weekly or all-time). */
export async function groupBoard(groupId: string, period: Period) {
  const week = weekStart();
  const rows = await db
    .select({
      studentId: schema.students.id,
      nickname: schema.students.nickname,
      discriminator: schema.students.discriminator,
      avatar: schema.students.avatar,
      score: sql<number>`coalesce(sum(${schema.pointsLedger.amount}) filter (where ${schema.pointsLedger.status} = 'counted' ${period === "weekly" ? sql`and ${schema.pointsLedger.weekStart} = ${week}` : sql``}), 0)`.mapWith(Number),
    })
    .from(schema.groupMembers)
    .innerJoin(schema.students, eq(schema.students.id, schema.groupMembers.studentId))
    .leftJoin(schema.pointsLedger, eq(schema.pointsLedger.studentId, schema.students.id))
    .where(and(eq(schema.groupMembers.groupId, groupId)))
    .groupBy(schema.students.id)
    .orderBy(sql`5 desc`, schema.students.nickname);
  let rank = 0;
  let prev: number | undefined;
  return rows.map((r, i) => {
    if (r.score !== prev) {
      rank = i + 1;
      prev = r.score;
    }
    return { ...r, rank };
  });
}
