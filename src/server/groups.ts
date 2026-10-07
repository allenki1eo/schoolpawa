import "server-only";
import { and, asc, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db/client";
import { generateCode, isValidCode, normalizeCode } from "@/lib/safety/codes";
import { checkName, GROUP_NAME_RULES } from "@/lib/safety/profanity";
import { GROUP_EMBLEMS, isPresetMessage, isReaction } from "@/lib/safety/presets";
import { localDate, addDays } from "@/lib/time";
import { audit } from "./audit";
import { config } from "./config";
import { secureRandomInt } from "./crypto";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";

type Student = typeof schema.students.$inferSelect;

export const MAX_MEMBERS = 30;
export const MAX_GROUPS_PER_STUDENT = 5;
export const INVITE_CODE_LENGTH = 6;

async function membershipCount(studentId: string, tx: Tx | typeof db = db) {
  const [row] = await tx.select({ n: count() }).from(schema.groupMembers).where(eq(schema.groupMembers.studentId, studentId));
  return row?.n ?? 0;
}

export async function createGroup(student: Student, input: { name: string; emblem: string }) {
  await rateLimit("groupAction", student.id);
  const name = checkName(input.name, { ...GROUP_NAME_RULES, extraBlocked: config.blockedTermsExtra });
  if (!name.ok) throw new ApiError(400, "group_name_rejected", { problem: name.problem });
  if (!(GROUP_EMBLEMS as readonly string[]).includes(input.emblem)) throw new ApiError(400, "emblem_invalid");
  if ((await membershipCount(student.id)) >= MAX_GROUPS_PER_STUDENT) throw new ApiError(400, "group_limit");

  for (let attempt = 0; attempt < 5; attempt++) {
    const group = await db.transaction(async (tx) => {
      const [g] = await tx
        .insert(schema.groups)
        .values({ name: name.value, emblem: input.emblem, inviteCode: generateCode(INVITE_CODE_LENGTH, secureRandomInt), creatorId: student.id })
        .onConflictDoNothing({ target: schema.groups.inviteCode })
        .returning();
      if (!g) return null;
      await tx.insert(schema.groupMembers).values({ groupId: g.id, studentId: student.id });
      await audit({ actorType: "student", actorId: student.id, action: "group.create", targetType: "group", targetId: g.id }, tx);
      return g;
    });
    if (group) return group;
  }
  throw new ApiError(500, "code_generation_failed");
}

export async function joinGroup(student: Student, rawCode: string) {
  await rateLimit("groupAction", student.id);
  const code = normalizeCode(rawCode);
  if (!isValidCode(code, INVITE_CODE_LENGTH)) throw new ApiError(400, "invite_invalid");
  const [group] = await db.select().from(schema.groups).where(and(eq(schema.groups.inviteCode, code), eq(schema.groups.archived, false)));
  if (!group) throw new ApiError(404, "invite_invalid");

  return db.transaction(async (tx) => {
    // Lock the group row so concurrent joins can't exceed the member cap.
    await tx.execute(sql`select id from groups where id = ${group.id} for update`);
    const [already] = await tx
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.studentId, student.id)));
    if (already) return group;
    const [members] = await tx.select({ n: count() }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id));
    if ((members?.n ?? 0) >= MAX_MEMBERS) throw new ApiError(400, "group_full");
    if ((await membershipCount(student.id, tx)) >= MAX_GROUPS_PER_STUDENT) throw new ApiError(400, "group_limit");
    await tx.insert(schema.groupMembers).values({ groupId: group.id, studentId: student.id });
    return group;
  });
}

/** Leaving: anyone, anytime. If the creator leaves, ownership passes to the longest-standing member. */
export async function leaveGroup(student: Student, groupId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.studentId, student.id)));
    await reassignOwnershipIfNeeded(tx, groupId, student.id);
  });
}

export async function reassignOwnershipIfNeeded(tx: Tx, groupId: string, departingId: string) {
  const [group] = await tx.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group || (group.creatorId && group.creatorId !== departingId)) return;
  const [heir] = await tx
    .select({ studentId: schema.groupMembers.studentId })
    .from(schema.groupMembers)
    .where(and(eq(schema.groupMembers.groupId, groupId), sql`${schema.groupMembers.studentId} <> ${departingId}`))
    .orderBy(asc(schema.groupMembers.joinedAt))
    .limit(1);
  await tx
    .update(schema.groups)
    .set(heir ? { creatorId: heir.studentId } : { creatorId: null, archived: true })
    .where(eq(schema.groups.id, groupId));
}

export async function removeMember(student: Student, groupId: string, memberId: string) {
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group || group.creatorId !== student.id) throw new ApiError(403, "not_group_creator");
  if (memberId === student.id) throw new ApiError(400, "use_leave");
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.studentId, memberId)));
  await audit({ actorType: "student", actorId: student.id, action: "group.remove_member", targetType: "group", targetId: groupId, meta: { memberId } });
}

export async function myGroups(student: Student) {
  const rows = await db
    .select({ group: schema.groups })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(and(eq(schema.groupMembers.studentId, student.id), eq(schema.groups.archived, false)))
    .orderBy(desc(schema.groupMembers.joinedAt));
  const ids = rows.map((r) => r.group.id);
  const counts = ids.length
    ? await db
        .select({ groupId: schema.groupMembers.groupId, n: count() })
        .from(schema.groupMembers)
        .where(inArray(schema.groupMembers.groupId, ids))
        .groupBy(schema.groupMembers.groupId)
    : [];
  const byId = new Map(counts.map((c) => [c.groupId, c.n]));
  return rows.map((r) => ({ ...r.group, members: byId.get(r.group.id) ?? 1 }));
}

export async function groupForMember(student: Student, groupId: string) {
  const [row] = await db
    .select({ group: schema.groups })
    .from(schema.groups)
    .innerJoin(schema.groupMembers, and(eq(schema.groupMembers.groupId, schema.groups.id), eq(schema.groupMembers.studentId, student.id)))
    .where(eq(schema.groups.id, groupId));
  if (!row) throw new ApiError(404, "group_not_found");
  return row.group;
}

/** Preset reaction or message — the only interaction allowed between members. */
export async function react(student: Student, groupId: string, presetKey: string, toStudentId?: string) {
  await rateLimit("reaction", student.id);
  if (!isReaction(presetKey) && !isPresetMessage(presetKey)) throw new ApiError(400, "preset_invalid");
  await groupForMember(student, groupId);
  if (toStudentId) {
    const [member] = await db
      .select()
      .from(schema.groupMembers)
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.studentId, toStudentId)));
    if (!member) throw new ApiError(400, "not_group_member");
  }
  await db.insert(schema.groupReactions).values({ groupId, fromStudentId: student.id, toStudentId: toStudentId ?? null, presetKey });
}

/** Recent reactions, hiding anything from/to students the viewer has blocked (or who blocked them). */
export async function recentReactions(student: Student, groupId: string, limit = 30) {
  const from = schema.students;
  const rows = await db
    .select({
      id: schema.groupReactions.id,
      presetKey: schema.groupReactions.presetKey,
      createdAt: schema.groupReactions.createdAt,
      fromId: from.id,
      fromNickname: from.nickname,
      fromAvatar: from.avatar,
      toId: schema.groupReactions.toStudentId,
    })
    .from(schema.groupReactions)
    .innerJoin(from, eq(from.id, schema.groupReactions.fromStudentId))
    .where(
      and(
        eq(schema.groupReactions.groupId, groupId),
        gte(schema.groupReactions.createdAt, new Date(Date.now() - 7 * 86_400_000)),
        sql`not exists (select 1 from blocks b where (b.blocker_id = ${student.id} and b.blocked_id = ${from.id}) or (b.blocker_id = ${from.id} and b.blocked_id = ${student.id}))`,
      ),
    )
    .orderBy(desc(schema.groupReactions.createdAt))
    .limit(limit);
  return rows;
}

/**
 * Group streak: a day counts when at least half the members completed a round. Evaluated
 * lazily when the group page is opened (cheap, and avoids a cron per group).
 */
export async function refreshGroupStreak(groupId: string) {
  const today = localDate();
  const yesterday = addDays(today, -1);
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));
  if (!group || group.lastStreakDate === today) return group?.streakDays ?? 0;

  const [stats] = await db.execute<{ members: string; played: string }>(sql`
    select count(*) as members,
      count(*) filter (where s.last_active_date = ${today}) as played
    from group_members gm join students s on s.id = gm.student_id
    where gm.group_id = ${groupId}`);
  const members = Number(stats?.members ?? 0);
  const played = Number(stats?.played ?? 0);
  if (members === 0 || played * 2 < members) {
    // Not yet qualified today; reset if yesterday was missed too.
    if (group.lastStreakDate && group.lastStreakDate < yesterday && group.streakDays !== 0) {
      await db.update(schema.groups).set({ streakDays: 0 }).where(eq(schema.groups.id, groupId));
      return 0;
    }
    return group.streakDays;
  }
  const streak = group.lastStreakDate === yesterday ? group.streakDays + 1 : 1;
  await db.update(schema.groups).set({ streakDays: streak, lastStreakDate: today }).where(eq(schema.groups.id, groupId));
  return streak;
}
