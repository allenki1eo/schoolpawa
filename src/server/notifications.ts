import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema, type Tx } from "@/db/client";

/**
 * In-app inbox. Child-safe by construction: payloads hold ids and preset keys only; names are
 * resolved at read time (so an erased student's nickname disappears from everyone's inbox).
 */
export type NotificationKind =
  | "challenge_received"
  | "challenge_result"
  | "level_up"
  | "battle_invite"
  | "battle_started"
  | "battle_result"
  | "quest_ready";

export async function notify(
  studentIds: string | string[],
  kind: NotificationKind,
  payload: Record<string, string | number | null> = {},
  tx?: Tx,
) {
  const ids = (Array.isArray(studentIds) ? studentIds : [studentIds]).filter(Boolean);
  if (ids.length === 0) return;
  await (tx ?? db).insert(schema.notifications).values(ids.map((studentId) => ({ studentId, kind, payload })));
}

export async function unreadCount(studentId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.studentId, studentId), isNull(schema.notifications.readAt)));
  return row?.n ?? 0;
}

export async function inbox(studentId: string, limit = 40) {
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.studentId, studentId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);
  const studentIds = [...new Set(rows.map((r) => r.payload.fromStudentId).filter((x): x is string => typeof x === "string"))];
  const groupIds = [...new Set(rows.flatMap((r) => [r.payload.groupId, r.payload.otherGroupId]).filter((x): x is string => typeof x === "string"))];
  const topicIds = [...new Set(rows.map((r) => r.payload.topicId).filter((x): x is string => typeof x === "string"))];
  const [students, groups, topics] = await Promise.all([
    studentIds.length ? db.select({ id: schema.students.id, nickname: schema.students.nickname, avatar: schema.students.avatar }).from(schema.students).where(inArray(schema.students.id, studentIds)) : [],
    groupIds.length ? db.select({ id: schema.groups.id, name: schema.groups.name, emblem: schema.groups.emblem }).from(schema.groups).where(inArray(schema.groups.id, groupIds)) : [],
    topicIds.length ? db.select({ id: schema.topics.id, nameSw: schema.topics.nameSw, nameEn: schema.topics.nameEn }).from(schema.topics).where(inArray(schema.topics.id, topicIds)) : [],
  ]);
  const s = new Map(students.map((x) => [x.id, x]));
  const g = new Map(groups.map((x) => [x.id, x]));
  const t = new Map(topics.map((x) => [x.id, x]));
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as NotificationKind,
    payload: r.payload,
    read: r.readAt !== null,
    createdAt: r.createdAt.toISOString(),
    from: typeof r.payload.fromStudentId === "string" ? (s.get(r.payload.fromStudentId) ?? null) : null,
    group: typeof r.payload.groupId === "string" ? (g.get(r.payload.groupId) ?? null) : null,
    otherGroup: typeof r.payload.otherGroupId === "string" ? (g.get(r.payload.otherGroupId) ?? null) : null,
    topic: typeof r.payload.topicId === "string" ? (t.get(r.payload.topicId) ?? null) : null,
  }));
}

export async function markAllRead(studentId: string) {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.studentId, studentId), isNull(schema.notifications.readAt)));
}
