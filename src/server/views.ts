import "server-only";
import { and, asc, eq } from "drizzle-orm";
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
