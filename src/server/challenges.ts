import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db/client";
import { createRng, newSeed } from "@/lib/quiz/rng";
import { QUESTIONS_PER_ROUND, CHALLENGE_DRAW_BONUS, CHALLENGE_WIN_BONUS } from "@/lib/quiz/scoring";
import { selectQuestions } from "@/lib/quiz/selection";
import { instantiate } from "@/lib/quiz/template";
import { decideChallenge, updateElo } from "@/lib/ranking/elo";
import { generateCode, normalizeCode, parseHandle } from "@/lib/safety/codes";
import { isPresetMessage, type PresetMessageKey } from "@/lib/safety/presets";
import type { ChallengeItem } from "@/db/schema";
import { audit } from "./audit";
import { secureRandomInt } from "./crypto";
import { ApiError } from "./http";
import { afterCommit, award } from "./ledger";
import { rateLimit } from "./rate-limit";
import { candidatesFor, loadSources } from "./quiz/content";
import { startSession } from "./quiz/engine";

type Student = typeof schema.students.$inferSelect;

const CHALLENGE_TTL_MS = 48 * 60 * 60 * 1000;

export async function isBlockedEitherWay(a: string, b: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.blocks)
    .where(
      or(
        and(eq(schema.blocks.blockerId, a), eq(schema.blocks.blockedId, b)),
        and(eq(schema.blocks.blockerId, b), eq(schema.blocks.blockedId, a)),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function findByHandle(handle: string) {
  const parsed = parseHandle(handle);
  if (!parsed) throw new ApiError(400, "handle_invalid");
  const [s] = await db
    .select()
    .from(schema.students)
    .where(and(sql`lower(${schema.students.nickname}) = lower(${parsed.nickname})`, eq(schema.students.discriminator, parsed.discriminator)));
  if (!s || s.status !== "active") throw new ApiError(404, "student_not_found");
  return s;
}

export interface CreateChallengeInput {
  topicId: string;
  opponentHandle?: string;
  opponentId?: string;
  groupId?: string;
  presetMessage?: string;
}

/**
 * Create a 1v1 challenge and start the challenger's round. Both players get the SAME question
 * IDs (and template parameters) so difficulty is identical; each session shuffles order and
 * options independently (see engine.startSession).
 */
export async function createChallenge(student: Student, input: CreateChallengeInput) {
  await rateLimit("challengeCreate", student.id);
  if (input.presetMessage && !isPresetMessage(input.presetMessage)) throw new ApiError(400, "preset_invalid");

  let opponent: Student | null = null;
  if (input.opponentHandle) opponent = await findByHandle(input.opponentHandle);
  else if (input.opponentId) {
    const [row] = await db.select().from(schema.students).where(eq(schema.students.id, input.opponentId));
    opponent = row ?? null;
    if (!opponent) throw new ApiError(404, "student_not_found");
  }
  if (opponent) {
    if (opponent.id === student.id) throw new ApiError(400, "cannot_challenge_self");
    if (opponent.gradeLevelId !== student.gradeLevelId) throw new ApiError(400, "opponent_wrong_grade");
    if (await isBlockedEitherWay(student.id, opponent.id)) throw new ApiError(403, "blocked");
  }
  if (input.groupId) {
    // Challenges "from a group" require both players to be members (keeps contact within connections).
    const members = await db
      .select({ id: schema.groupMembers.studentId })
      .from(schema.groupMembers)
      .where(eq(schema.groupMembers.groupId, input.groupId));
    const ids = new Set(members.map((m) => m.id));
    if (!ids.has(student.id) || (opponent && !ids.has(opponent.id))) throw new ApiError(403, "not_group_member");
  }

  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.id, input.topicId));
  if (!topic?.isLive || topic.gradeLevelId !== student.gradeLevelId) throw new ApiError(404, "topic_unavailable");

  // Neutral selection (accuracy = null, nothing "seen") so neither player is favoured.
  const seed = newSeed();
  const rng = createRng(seed);
  const picked = selectQuestions({
    candidates: await candidatesFor(topic.id),
    seen: new Map(),
    accuracy: null,
    count: QUESTIONS_PER_ROUND,
    rng: rng.fork("select"),
  });
  const sources = await loadSources(picked.map((p) => p.key));
  const items: ChallengeItem[] = picked.map((p, i) => {
    const spec = sources.get(p.key)?.spec;
    return { key: p.key, difficulty: p.difficulty, params: spec ? instantiate(spec, rng.fork(`inst:${i}`)).params : undefined };
  });

  let challenge: typeof schema.challenges.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !challenge; attempt++) {
    [challenge] = await db
      .insert(schema.challenges)
      .values({
        code: generateCode(6, secureRandomInt),
        challengerId: student.id,
        opponentId: opponent?.id ?? null,
        groupId: input.groupId ?? null,
        topicId: topic.id,
        seed,
        items,
        presetMessage: (input.presetMessage as PresetMessageKey | undefined) ?? null,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      })
      .onConflictDoNothing({ target: schema.challenges.code })
      .returning();
  }
  if (!challenge) throw new ApiError(500, "code_generation_failed");

  const started = await startSession({ student, topicId: topic.id, kind: "challenge", challenge: { id: challenge.id, items } });
  await db.update(schema.challenges).set({ challengerSessionId: started.sessionId }).where(eq(schema.challenges.id, challenge.id));
  await audit({ actorType: "student", actorId: student.id, action: "challenge.create", targetType: "challenge", targetId: challenge.id });
  return { challengeId: challenge.id, code: challenge.code, ...started };
}

export async function challengeByCode(code: string) {
  const [c] = await db.select().from(schema.challenges).where(eq(schema.challenges.code, normalizeCode(code)));
  return c ?? null;
}

/** Accept (or play the waiting side of) a challenge. */
export async function acceptChallenge(student: Student, code: string) {
  const c = await challengeByCode(code);
  if (!c) throw new ApiError(404, "challenge_not_found");
  if (c.status !== "open" || c.expiresAt.getTime() < Date.now()) throw new ApiError(410, "challenge_closed");
  if (c.challengerId === student.id) throw new ApiError(400, "cannot_challenge_self");
  if (c.opponentId && c.opponentId !== student.id) throw new ApiError(403, "challenge_not_for_you");
  if (c.opponentSessionId) throw new ApiError(409, "challenge_already_played");

  const [challenger] = await db.select().from(schema.students).where(eq(schema.students.id, c.challengerId));
  if (!challenger || challenger.gradeLevelId !== student.gradeLevelId) throw new ApiError(400, "opponent_wrong_grade");
  if (await isBlockedEitherWay(student.id, c.challengerId)) throw new ApiError(403, "blocked");

  // Claim the open slot atomically so two people can't both accept a share-link challenge.
  const claimed = await db
    .update(schema.challenges)
    .set({ opponentId: student.id })
    .where(and(eq(schema.challenges.id, c.id), or(sql`${schema.challenges.opponentId} is null`, eq(schema.challenges.opponentId, student.id))))
    .returning({ id: schema.challenges.id });
  if (claimed.length === 0) throw new ApiError(409, "challenge_taken");

  const started = await startSession({ student, topicId: c.topicId, kind: "challenge", challenge: { id: c.id, items: c.items } });
  await db.update(schema.challenges).set({ opponentSessionId: started.sessionId }).where(eq(schema.challenges.id, c.id));
  return { challengeId: c.id, ...started };
}

export async function declineChallenge(student: Student, challengeId: string) {
  await db
    .update(schema.challenges)
    .set({ status: "declined" })
    .where(and(eq(schema.challenges.id, challengeId), eq(schema.challenges.opponentId, student.id), eq(schema.challenges.status, "open")));
}

/** When both rounds are complete: decide, update Elo, award bonus points. Idempotent. */
export async function onChallengeSessionFinished(challengeId: string) {
  const [c] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, challengeId));
  if (!c || c.status !== "open" || !c.challengerSessionId || !c.opponentSessionId || !c.opponentId) return;
  const sessions = await db
    .select()
    .from(schema.quizSessions)
    .where(or(eq(schema.quizSessions.id, c.challengerSessionId), eq(schema.quizSessions.id, c.opponentSessionId)));
  const a = sessions.find((s) => s.id === c.challengerSessionId);
  const b = sessions.find((s) => s.id === c.opponentSessionId);
  if (a?.status !== "completed" || b?.status !== "completed") return;

  // Held (suspicious) rounds forfeit: integrity first.
  const outcome = a.held && !b.held ? 0 : b.held && !a.held ? 1 : decideChallenge(a, b);
  const winnerId = outcome === 1 ? c.challengerId : outcome === 0 ? c.opponentId : null;

  const result = await db.transaction(async (tx) => {
    const done = await tx
      .update(schema.challenges)
      .set({ status: "completed", winnerId, completedAt: new Date() })
      .where(and(eq(schema.challenges.id, c.id), eq(schema.challenges.status, "open")))
      .returning({ id: schema.challenges.id });
    if (done.length === 0) return null;
    const players = await tx
      .select()
      .from(schema.students)
      .where(or(eq(schema.students.id, c.challengerId), eq(schema.students.id, c.opponentId!)));
    const pa = players.find((p) => p.id === c.challengerId)!;
    const pb = players.find((p) => p.id === c.opponentId)!;
    const ratings = updateElo({ rating: pa.rating, games: pa.ratedGames }, { rating: pb.rating, games: pb.ratedGames }, outcome);
    await tx.update(schema.students).set({ rating: ratings.a, ratedGames: sql`${schema.students.ratedGames} + 1` }).where(eq(schema.students.id, pa.id));
    await tx.update(schema.students).set({ rating: ratings.b, ratedGames: sql`${schema.students.ratedGames} + 1` }).where(eq(schema.students.id, pb.id));

    const awards: Array<{ studentId: string; amount: number; result: Awaited<ReturnType<typeof award>> }> = [];
    const give = async (studentId: string, amount: number, held: boolean) =>
      awards.push({ studentId, amount, result: await award(tx, { studentId, amount, source: "challenge_bonus", held, refId: c.id }) });
    if (outcome === 0.5) {
      await give(pa.id, CHALLENGE_DRAW_BONUS, a.held);
      await give(pb.id, CHALLENGE_DRAW_BONUS, b.held);
    } else if (winnerId) {
      await give(winnerId, CHALLENGE_WIN_BONUS, winnerId === pa.id ? a.held : b.held);
    }
    return awards;
  });
  if (!result) return;
  for (const r of result) await afterCommit(r.studentId, [{ amount: r.amount, result: r.result }]);
}

export async function myChallenges(student: Student) {
  const challenger = alias(schema.students, "challenger");
  const opponent = alias(schema.students, "opponent");
  const rows = await db
    .select({
      c: schema.challenges,
      topicSw: schema.topics.nameSw,
      topicEn: schema.topics.nameEn,
      challenger: { id: challenger.id, nickname: challenger.nickname, discriminator: challenger.discriminator, avatar: challenger.avatar },
      opponent: { id: opponent.id, nickname: opponent.nickname, discriminator: opponent.discriminator, avatar: opponent.avatar },
    })
    .from(schema.challenges)
    .innerJoin(schema.topics, eq(schema.topics.id, schema.challenges.topicId))
    .innerJoin(challenger, eq(challenger.id, schema.challenges.challengerId))
    .leftJoin(opponent, eq(opponent.id, schema.challenges.opponentId))
    .where(or(eq(schema.challenges.challengerId, student.id), eq(schema.challenges.opponentId, student.id)))
    .orderBy(desc(schema.challenges.createdAt))
    .limit(30);

  const sessionIds = rows.flatMap((r) => [r.c.challengerSessionId, r.c.opponentSessionId]).filter((x): x is string => Boolean(x));
  const scores = sessionIds.length
    ? await db
        .select({ id: schema.quizSessions.id, score: schema.quizSessions.score, status: schema.quizSessions.status })
        .from(schema.quizSessions)
        .where(sql`${schema.quizSessions.id} in ${sessionIds}`)
    : [];
  const byId = new Map(scores.map((s) => [s.id, s]));
  const now = Date.now();
  return rows.map((r) => {
    const mine = r.c.challengerId === student.id ? r.c.challengerSessionId : r.c.opponentSessionId;
    const theirs = r.c.challengerId === student.id ? r.c.opponentSessionId : r.c.challengerSessionId;
    const expired = r.c.status === "open" && r.c.expiresAt.getTime() < now;
    return {
      id: r.c.id,
      code: r.c.code,
      status: expired ? ("expired" as const) : r.c.status,
      iAmChallenger: r.c.challengerId === student.id,
      topic: { sw: r.topicSw, en: r.topicEn },
      challenger: r.challenger,
      opponent: r.opponent?.id ? r.opponent : null,
      presetMessage: r.c.presetMessage,
      myScore: mine && byId.get(mine)?.status === "completed" ? byId.get(mine)!.score : null,
      // Opponent's score is revealed only once I've played (no peeking before my round).
      theirScore:
        mine && byId.get(mine)?.status === "completed" && theirs && byId.get(theirs)?.status === "completed"
          ? byId.get(theirs)!.score
          : null,
      iHavePlayed: Boolean(mine && byId.get(mine)?.status === "completed"),
      winnerId: r.c.winnerId,
      expiresAt: r.c.expiresAt.toISOString(),
    };
  });
}
