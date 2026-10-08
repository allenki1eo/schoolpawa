import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { localDate } from "@/lib/time";
import { dailyTopicFor } from "./quiz/daily";

/** Read models shared by several student pages. */

export async function studentContext(student: typeof schema.students.$inferSelect) {
  const [row] = await db
    .select({
      schoolName: schema.schools.name,
      regNo: schema.schools.regNo,
      stage: schema.schools.stage,
      sizeBand: schema.schools.sizeBand,
      regionColor: schema.regions.color,
      regionId: schema.regions.id,
      regionName: schema.regions.name,
      districtId: schema.districts.id,
      districtName: schema.districts.name,
      gradeSw: schema.gradeLevels.labelSw,
      gradeEn: schema.gradeLevels.labelEn,
    })
    .from(schema.schools)
    .innerJoin(schema.districts, eq(schema.districts.id, schema.schools.districtId))
    .innerJoin(schema.regions, eq(schema.regions.id, schema.districts.regionId))
    .innerJoin(schema.gradeLevels, eq(schema.gradeLevels.id, student.gradeLevelId))
    .where(eq(schema.schools.id, student.schoolId));
  return row!;
}

export async function subjectsWithTopics(gradeLevelId: string) {
  const rows = await db
    .select({ topic: schema.topics, subject: schema.subjects })
    .from(schema.topics)
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.topics.subjectId))
    .where(and(eq(schema.topics.gradeLevelId, gradeLevelId), eq(schema.topics.isLive, true)))
    .orderBy(asc(schema.subjects.code), asc(schema.topics.sortOrder));
  const bySubject = new Map<string, { subject: typeof schema.subjects.$inferSelect; topics: (typeof schema.topics.$inferSelect)[] }>();
  for (const r of rows) {
    const entry = bySubject.get(r.subject.id) ?? { subject: r.subject, topics: [] };
    entry.topics.push(r.topic);
    bySubject.set(r.subject.id, entry);
  }
  return [...bySubject.values()];
}

export async function dailyStatus(student: typeof schema.students.$inferSelect) {
  const today = localDate();
  const topic = await dailyTopicFor(student.gradeLevelId, today);
  if (!topic) return null;
  const [subject] = await db.select().from(schema.subjects).where(eq(schema.subjects.id, topic.subjectId));
  const [played] = await db
    .select({ score: schema.quizSessions.score, status: schema.quizSessions.status, id: schema.quizSessions.id })
    .from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, student.id), eq(schema.quizSessions.kind, "daily"), eq(schema.quizSessions.dailyDate, today)));
  return { topic, subject: subject!, played: played ?? null };
}

/** Which days (Mon..Sun, local) of the current week the student completed a round. */
export async function activeDaysThisWeek(studentId: string) {
  const { weekStart: ws, localDate: ld } = await import("@/lib/time");
  const monday = ws();
  const rows = await db.execute<{ d: string }>(sql`
    select distinct to_char((finished_at at time zone 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') as d
    from quiz_sessions
    where student_id = ${studentId} and status = 'completed'
      and finished_at >= ${new Date(`${monday}T00:00:00+03:00`).toISOString()}`);
  const days = new Set(rows.map((r) => r.d));
  const active = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${monday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return days.has(d.toISOString().slice(0, 10));
  });
  const todayIndex = Math.round((Date.parse(`${ld()}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / 86_400_000);
  return { active, todayIndex };
}

/** Best correct count per topic (for mastery stars). */
export async function topicBests(studentId: string) {
  const rows = await db
    .select({ topicId: schema.quizSessions.topicId, best: sql<number>`max(${schema.quizSessions.correctCount})`.mapWith(Number), rounds: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.quizSessions)
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, "completed")))
    .groupBy(schema.quizSessions.topicId);
  return new Map(rows.map((r) => [r.topicId, r]));
}
