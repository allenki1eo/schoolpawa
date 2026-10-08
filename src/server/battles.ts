import "server-only";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { BATTLE_ACCEPT_WINDOW_MS, BATTLE_DURATION_MS, decideBattle, MIN_BATTLE_MEMBERS } from "@/lib/game/battle";
import { isValidCode, normalizeCode } from "@/lib/safety/codes";
import { audit } from "./audit";
import { groupForMember } from "./groups";
import { ApiError } from "./http";
import { notify } from "./notifications";
import { rateLimit } from "./rate-limit";

type Student = typeof schema.students.$inferSelect;
type Battle = typeof schema.groupBattles.$inferSelect;

async function memberIds(groupId: string) {
  const rows = await db.select({ id: schema.groupMembers.studentId }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, groupId));
  return rows.map((r) => r.id);
}

async function isCreator(student: Student, groupId: string) {
  const [g] = await db.select({ creatorId: schema.groups.creatorId }).from(schema.groups).where(eq(schema.groups.id, groupId));
  return g?.creatorId === student.id;
}

/** A group founder challenges another group (found by its invite code) on one topic. */
export async function createBattle(student: Student, groupId: string, input: { opponentCode: string; topicId: string }) {
  await rateLimit("groupAction", student.id);
  const group = await groupForMember(student, groupId);
  if (!(await isCreator(student, groupId))) throw new ApiError(403, "not_group_creator");
  const code = normalizeCode(input.opponentCode);
  if (!isValidCode(code, 6)) throw new ApiError(400, "invite_invalid");
  const [opponent] = await db.select().from(schema.groups).where(and(eq(schema.groups.inviteCode, code), eq(schema.groups.archived, false)));
  if (!opponent) throw new ApiError(404, "invite_invalid");
  if (opponent.id === group.id) throw new ApiError(400, "battle_self");
  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.id, input.topicId));
  if (!topic?.isLive) throw new ApiError(404, "topic_unavailable");

  const [[mine], [theirs]] = await Promise.all([
    db.select({ n: count() }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, group.id)),
    db.select({ n: count() }).from(schema.groupMembers).where(eq(schema.groupMembers.groupId, opponent.id)),
  ]);
  if ((mine?.n ?? 0) < MIN_BATTLE_MEMBERS || (theirs?.n ?? 0) < MIN_BATTLE_MEMBERS) throw new ApiError(400, "battle_too_small");

  const [open] = await db
    .select({ id: schema.groupBattles.id })
    .from(schema.groupBattles)
    .where(
      and(
        inArray(schema.groupBattles.status, ["pending", "active"]),
        or(
          and(eq(schema.groupBattles.challengerGroupId, group.id), eq(schema.groupBattles.opponentGroupId, opponent.id)),
          and(eq(schema.groupBattles.challengerGroupId, opponent.id), eq(schema.groupBattles.opponentGroupId, group.id)),
        ),
      ),
    );
  if (open) throw new ApiError(409, "battle_exists");

  const [battle] = await db
    .insert(schema.groupBattles)
    .values({ challengerGroupId: group.id, opponentGroupId: opponent.id, topicId: topic.id, createdBy: student.id })
    .returning();
  if (opponent.creatorId) await notify(opponent.creatorId, "battle_invite", { battleId: battle!.id, groupId: group.id, otherGroupId: opponent.id, topicId: topic.id });
  await audit({ actorType: "student", actorId: student.id, action: "battle.create", targetType: "battle", targetId: battle!.id });
  return battle!;
}

export async function respondBattle(student: Student, battleId: string, accept: boolean) {
  const [b] = await db.select().from(schema.groupBattles).where(eq(schema.groupBattles.id, battleId));
  if (!b || b.status !== "pending") throw new ApiError(404, "battle_not_found");
  if (!(await isCreator(student, b.opponentGroupId))) throw new ApiError(403, "not_group_creator");
  if (Date.now() - b.createdAt.getTime() > BATTLE_ACCEPT_WINDOW_MS) {
    await db.update(schema.groupBattles).set({ status: "expired" }).where(eq(schema.groupBattles.id, b.id));
    throw new ApiError(410, "battle_expired");
  }
  if (!accept) {
    await db.update(schema.groupBattles).set({ status: "declined" }).where(eq(schema.groupBattles.id, b.id));
    return;
  }
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + BATTLE_DURATION_MS);
  await db.update(schema.groupBattles).set({ status: "active", startsAt, endsAt }).where(eq(schema.groupBattles.id, b.id));
  const everyone = [...(await memberIds(b.challengerGroupId)), ...(await memberIds(b.opponentGroupId))];
  await notify(everyone, "battle_started", { battleId: b.id, groupId: b.challengerGroupId, otherGroupId: b.opponentGroupId, topicId: b.topicId });
}

/** Live score for a battle: points in the topic during the window / current member count. */
export async function battleStanding(b: Battle) {
  if (!b.startsAt || !b.endsAt) return null;
  const end = new Date(Math.min(Date.now(), b.endsAt.getTime()));
  const side = async (groupId: string) => {
    const [row] = await db.execute<{ points: string | null; members: string; active: string }>(sql`
      select
        (select count(*) from group_members gm where gm.group_id = ${groupId}) as members,
        (select count(distinct l.student_id) from points_ledger l join quiz_sessions q on q.id::text = l.ref_id
           join group_members gm on gm.student_id = l.student_id and gm.group_id = ${groupId}
           where l.status = 'counted' and q.topic_id = ${b.topicId}
             and l.created_at between ${b.startsAt!.toISOString()} and ${end.toISOString()}) as active,
        (select sum(l.amount) from points_ledger l join quiz_sessions q on q.id::text = l.ref_id
           join group_members gm on gm.student_id = l.student_id and gm.group_id = ${groupId}
           where l.status = 'counted' and q.topic_id = ${b.topicId}
             and l.created_at between ${b.startsAt!.toISOString()} and ${end.toISOString()}) as points`);
    return { points: Number(row?.points ?? 0), members: Number(row?.members ?? 0), active: Number(row?.active ?? 0) };
  };
  const [a, o] = await Promise.all([side(b.challengerGroupId), side(b.opponentGroupId)]);
  const result = decideBattle(a, o);
  return { challenger: { ...a, score: result.a }, opponent: { ...o, score: result.b }, winner: result.winner };
}

/** Close finished battles (called lazily when battles are viewed, and by the nightly cron). */
export async function settleBattles() {
  const due = await db
    .select()
    .from(schema.groupBattles)
    .where(and(eq(schema.groupBattles.status, "active"), sql`${schema.groupBattles.endsAt} < now()`));
  for (const b of due) {
    const s = await battleStanding(b);
    if (!s) continue;
    const winnerGroupId = s.winner === "a" ? b.challengerGroupId : s.winner === "b" ? b.opponentGroupId : null;
    const done = await db
      .update(schema.groupBattles)
      .set({ status: "completed", challengerScore: s.challenger.score, opponentScore: s.opponent.score, winnerGroupId })
      .where(and(eq(schema.groupBattles.id, b.id), eq(schema.groupBattles.status, "active")))
      .returning({ id: schema.groupBattles.id });
    if (done.length === 0) continue;
    const everyone = [...(await memberIds(b.challengerGroupId)), ...(await memberIds(b.opponentGroupId))];
    await notify(everyone, "battle_result", { battleId: b.id, groupId: b.challengerGroupId, otherGroupId: b.opponentGroupId, winnerGroupId, topicId: b.topicId });
  }
  await db
    .update(schema.groupBattles)
    .set({ status: "expired" })
    .where(and(eq(schema.groupBattles.status, "pending"), sql`${schema.groupBattles.createdAt} < now() - interval '2 days'`));
  return { settled: due.length };
}

export async function battlesForGroup(groupId: string) {
  await settleBattles();
  const rows = await db
    .select()
    .from(schema.groupBattles)
    .where(or(eq(schema.groupBattles.challengerGroupId, groupId), eq(schema.groupBattles.opponentGroupId, groupId)))
    .orderBy(desc(schema.groupBattles.createdAt))
    .limit(10);
  const groupIds = [...new Set(rows.flatMap((r) => [r.challengerGroupId, r.opponentGroupId]))];
  const topicIds = [...new Set(rows.map((r) => r.topicId))];
  const [groups, topics] = await Promise.all([
    groupIds.length ? db.select({ id: schema.groups.id, name: schema.groups.name, emblem: schema.groups.emblem }).from(schema.groups).where(inArray(schema.groups.id, groupIds)) : [],
    topicIds.length ? db.select({ id: schema.topics.id, nameSw: schema.topics.nameSw, nameEn: schema.topics.nameEn }).from(schema.topics).where(inArray(schema.topics.id, topicIds)) : [],
  ]);
  const g = new Map(groups.map((x) => [x.id, x]));
  const t = new Map(topics.map((x) => [x.id, x]));
  return Promise.all(
    rows.map(async (b) => ({
      id: b.id,
      status: b.status,
      mineIsChallenger: b.challengerGroupId === groupId,
      challenger: g.get(b.challengerGroupId) ?? null,
      opponent: g.get(b.opponentGroupId) ?? null,
      topic: t.get(b.topicId) ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      winnerGroupId: b.winnerGroupId,
      standing: b.status === "active" ? await battleStanding(b) : null,
      final: b.status === "completed" ? { challenger: b.challengerScore ?? 0, opponent: b.opponentScore ?? 0 } : null,
    })),
  );
}

/** Battle wins for the trophy cabinet. */
export async function groupBattleWins(studentId: string) {
  const [row] = await db.execute<{ n: string }>(sql`
    select count(*) as n from group_battles b join group_members gm on gm.group_id = b.winner_group_id
    where gm.student_id = ${studentId} and b.status = 'completed'`);
  return Number(row?.n ?? 0);
}
