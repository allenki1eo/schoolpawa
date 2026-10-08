import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { longestRun, questByKey, questStates, type QuestStats } from "@/lib/game/quests";
import { localDate, weekStart } from "@/lib/time";
import { audit } from "./audit";
import { ApiError } from "./http";
import { afterCommit, award } from "./ledger";

/** Local midnight (EAT) as a UTC Date. */
function eatMidnight(isoDate: string) {
  return new Date(`${isoDate}T00:00:00+03:00`);
}

export async function questStats(studentId: string): Promise<QuestStats> {
  const today = localDate();
  const monday = weekStart();
  const dayStart = eatMidnight(today);
  const weekStartAt = eatMidnight(monday);

  const [agg] = await db.execute<{
    rounds_today: string; daily_today: string; duels_today: string; perfect_today: string; rounds_week: string; topics_week: string; cheers_week: string;
  }>(sql`
    select
      count(*) filter (where q.finished_at >= ${dayStart.toISOString()}) as rounds_today,
      count(*) filter (where q.finished_at >= ${dayStart.toISOString()} and q.kind = 'daily') as daily_today,
      count(*) filter (where q.finished_at >= ${dayStart.toISOString()} and q.kind = 'challenge') as duels_today,
      count(*) filter (where q.finished_at >= ${dayStart.toISOString()} and q.correct_count = q.question_count) as perfect_today,
      count(*) as rounds_week,
      count(distinct q.topic_id) as topics_week,
      (select count(*) from group_reactions r where r.from_student_id = ${studentId} and r.created_at >= ${weekStartAt.toISOString()}) as cheers_week
    from quiz_sessions q
    where q.student_id = ${studentId} and q.status = 'completed' and q.finished_at >= ${weekStartAt.toISOString()}`);

  // Best correct-answer run in any round finished today.
  const answers = await db
    .select({ sessionId: schema.answers.sessionId, position: schema.answers.position, correct: schema.answers.isCorrect })
    .from(schema.answers)
    .innerJoin(schema.quizSessions, eq(schema.quizSessions.id, schema.answers.sessionId))
    .where(and(eq(schema.quizSessions.studentId, studentId), eq(schema.quizSessions.status, "completed"), gte(schema.quizSessions.finishedAt, dayStart)))
    .orderBy(schema.answers.sessionId, schema.answers.position);
  const bySession = new Map<string, boolean[]>();
  for (const a of answers) bySession.set(a.sessionId, [...(bySession.get(a.sessionId) ?? []), Boolean(a.correct)]);
  const bestRunToday = Math.max(0, ...[...bySession.values()].map(longestRun));

  return {
    roundsToday: Number(agg?.rounds_today ?? 0),
    bestRunToday,
    dailyDoneToday: Number(agg?.daily_today ?? 0) > 0,
    challengesToday: Number(agg?.duels_today ?? 0),
    perfectToday: Number(agg?.perfect_today ?? 0) > 0,
    roundsThisWeek: Number(agg?.rounds_week ?? 0),
    topicsThisWeek: Number(agg?.topics_week ?? 0),
    cheersThisWeek: Number(agg?.cheers_week ?? 0),
  };
}

function periodFor(period: "daily" | "weekly") {
  return period === "daily" ? localDate() : weekStart();
}

export async function questsFor(studentId: string) {
  const [stats, claims] = await Promise.all([
    questStats(studentId),
    db
      .select({ key: schema.questClaims.questKey, period: schema.questClaims.period })
      .from(schema.questClaims)
      .where(and(eq(schema.questClaims.studentId, studentId), gte(schema.questClaims.period, weekStart()))),
  ]);
  const claimed = new Set(
    claims
      .filter((c) => {
        const def = questByKey(c.key);
        return def ? c.period === periodFor(def.period) : false;
      })
      .map((c) => c.key),
  );
  return questStates(stats, claimed);
}

/** Verify completion server-side, then append a fixed reward to the ledger exactly once. */
export async function claimQuest(student: typeof schema.students.$inferSelect, key: string) {
  const def = questByKey(key);
  if (!def) throw new ApiError(400, "quest_invalid");
  const state = (await questsFor(student.id)).find((q) => q.key === key)!;
  if (state.claimed) throw new ApiError(409, "quest_claimed");
  if (!state.complete) throw new ApiError(400, "quest_incomplete");
  const period = periodFor(def.period);

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.questClaims)
      .values({ studentId: student.id, questKey: key, period, reward: def.reward })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) throw new ApiError(409, "quest_claimed");
    return award(tx, { studentId: student.id, amount: def.reward, source: "quest", refId: `${key}:${period}` });
  });
  await afterCommit(student.id, [{ amount: def.reward, result }]);
  await audit({ actorType: "student", actorId: student.id, action: "quest.claim", meta: { key, reward: def.reward } });
  return { reward: def.reward };
}
