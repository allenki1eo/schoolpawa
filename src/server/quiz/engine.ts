import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db/client";
import { assessRound } from "@/lib/integrity/anomaly";
import { createRng, newSeed } from "@/lib/quiz/rng";
import { QUESTIONS_PER_ROUND, scoreAnswer, serverElapsed, isTimedOut, TIME_LIMIT_MS, type RoundKind } from "@/lib/quiz/scoring";
import { recentAccuracy, selectQuestions } from "@/lib/quiz/selection";
import { correctDisplay, displayedOptions, isCorrect, shuffleOptions } from "@/lib/quiz/shuffle";
import { instantiate, render } from "@/lib/quiz/template";
import type { ConcreteQuestion, Difficulty, SubmittedAnswer } from "@/lib/quiz/types";
import { leveledUp } from "@/lib/ranking/levels";
import { localDate } from "@/lib/time";
import type { ChallengeItem } from "@/db/schema";
import { ApiError } from "../http";
import { afterCommit, award, touchStreak, type LedgerSource } from "../ledger";
import { rateLimit } from "../rate-limit";
import { candidatesFor, loadSources, questionForAnswerRow, renderRng } from "./content";
import { dailyTopicFor } from "./daily";

type Student = typeof schema.students.$inferSelect;

const LEDGER_SOURCE: Record<RoundKind, LedgerSource> = {
  practice: "quiz",
  daily: "daily",
  challenge: "challenge",
  offline: "offline",
};

export interface QuestionDto {
  position: number;
  total: number;
  type: ConcreteQuestion["type"];
  prompt: string;
  options: string[];
  unit?: string;
  difficulty: Difficulty;
  limitMs: number;
}

export interface FeedbackDto {
  correct: boolean;
  timedOut: boolean;
  /** Display index (mcq), display order (ordering), boolean (true/false) or number. */
  correctAnswer: number | number[] | boolean;
  explanation: string;
  points: number;
  /** Static question id (for "flag this question"); null for template instances. */
  questionRef: string | null;
}

export interface SummaryDto {
  score: number;
  correct: number;
  total: number;
  held: boolean;
  streak: number;
  xp: number;
  leveledUp: boolean;
  challengeId: string | null;
}

/** Client-safe question: no answer, options in this student's shuffled order. */
function toDto(q: ConcreteQuestion, order: number[], position: number, total: number, difficulty: Difficulty): QuestionDto {
  return {
    position,
    total,
    type: q.type,
    prompt: q.prompt,
    options: q.type === "mcq" || q.type === "ordering" ? displayedOptions(q.options, order) : [],
    unit: q.unit,
    difficulty,
    limitMs: TIME_LIMIT_MS[q.type],
  };
}

// ─── Start ──────────────────────────────────────────────────────────────────────────────────

export interface StartInput {
  student: Student;
  topicId: string;
  kind: Exclude<RoundKind, "offline">;
  challenge?: { id: string; items: ChallengeItem[] };
}

export async function startSession({ student, topicId, kind, challenge }: StartInput) {
  await rateLimit("quizStart", student.id);

  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.id, topicId));
  if (!topic || !topic.isLive) throw new ApiError(404, "topic_unavailable");
  if (topic.gradeLevelId !== student.gradeLevelId) throw new ApiError(403, "topic_wrong_grade");

  let dailyDate: string | null = null;
  if (kind === "daily") {
    dailyDate = localDate();
    const daily = await dailyTopicFor(student.gradeLevelId, dailyDate);
    if (!daily || daily.id !== topicId) throw new ApiError(400, "not_todays_topic");
    const [done] = await db
      .select({ id: schema.quizSessions.id })
      .from(schema.quizSessions)
      .where(and(eq(schema.quizSessions.studentId, student.id), eq(schema.quizSessions.kind, "daily"), eq(schema.quizSessions.dailyDate, dailyDate)));
    if (done) throw new ApiError(409, "daily_already_played");
  }

  const seed = newSeed();
  const rng = createRng(seed);

  // 1. Choose the item keys (and fixed template params for challenges).
  let picks: ChallengeItem[];
  if (challenge) {
    // Same question IDs and params as the opponent; this player's own order.
    picks = rng.fork("order").shuffle(challenge.items);
  } else {
    const candidates = await candidatesFor(topicId);
    const keys = candidates.map((c) => c.key);
    const [seenRows, recent] = await Promise.all([
      keys.length
        ? db
            .select()
            .from(schema.seenQuestions)
            .where(and(eq(schema.seenQuestions.studentId, student.id), inArray(schema.seenQuestions.itemKey, keys)))
        : [],
      db
        .select({ correct: schema.answers.isCorrect })
        .from(schema.answers)
        .innerJoin(schema.quizSessions, eq(schema.quizSessions.id, schema.answers.sessionId))
        .where(and(eq(schema.quizSessions.studentId, student.id), isNotNull(schema.answers.isCorrect)))
        .orderBy(desc(schema.answers.answeredAt))
        .limit(30),
    ]);
    const seen = new Map(seenRows.map((r) => [r.itemKey, { lastSeenAt: r.lastSeenAt.getTime(), timesSeen: r.timesSeen }]));
    const accuracy = recentAccuracy(recent.map((r) => Boolean(r.correct)));
    picks = selectQuestions({ candidates, seen, accuracy, count: QUESTIONS_PER_ROUND, rng: rng.fork("select") }).map((c) => ({
      key: c.key,
      difficulty: c.difficulty,
    }));
  }
  if (picks.length === 0) throw new ApiError(404, "topic_unavailable");

  // 2. Materialise each item: template params, concrete question, option shuffle.
  const sources = await loadSources(picks.map((p) => p.key));
  const rows = picks.map((pick, position) => {
    const src = sources.get(pick.key);
    if (!src) throw new ApiError(409, "content_changed");
    let question: ConcreteQuestion;
    let params: Record<string, number> | undefined = pick.params;
    if (src.spec) {
      params ??= instantiate(src.spec, rng.fork(`inst:${position}`)).params;
      question = render(src.spec, params, renderRng(seed, position));
    } else {
      question = src.staticQ!;
    }
    const optionOrder = shuffleOptions(question, rng.fork(`opt:${position}`));
    return { position, pick, src, question, params, optionOrder };
  });

  const session = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(schema.quizSessions)
      .values({
        studentId: student.id,
        kind,
        topicId,
        seed,
        questionCount: rows.length,
        challengeId: challenge?.id,
        dailyDate,
      })
      .returning();
    await tx.insert(schema.answers).values(
      rows.map((r) => ({
        sessionId: s!.id,
        position: r.position,
        questionId: r.pick.key.startsWith("q:") ? r.pick.key.slice(2) : null,
        templateId: r.pick.key.startsWith("t:") ? r.pick.key.slice(2) : null,
        params: r.params ?? null,
        optionOrder: r.optionOrder,
        difficulty: r.src.difficulty,
        // Served (and timed) only when the player screen requests it.
        servedAt: null,
      })),
    );
    // Mark as seen at start, so abandoning a round cannot be used to re-roll questions.
    const uniqueKeys = [...new Set(rows.map((r) => r.pick.key))];
    await tx
      .insert(schema.seenQuestions)
      .values(uniqueKeys.map((itemKey) => ({ studentId: student.id, itemKey })))
      .onConflictDoUpdate({
        target: [schema.seenQuestions.studentId, schema.seenQuestions.itemKey],
        set: { lastSeenAt: new Date(), timesSeen: sql`${schema.seenQuestions.timesSeen} + 1` },
      });
    return s!;
  });

  return { sessionId: session.id, kind };
}

// ─── State (resume after reload) ────────────────────────────────────────────────────────────

export async function sessionState(student: Student, sessionId: string) {
  const session = await ownSession(student, sessionId);
  const rows = await db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).orderBy(asc(schema.answers.position));
  if (session.status !== "active") {
    return { sessionId, status: session.status, score: session.score, correct: session.correctCount, total: rows.length };
  }
  const current = rows.find((r) => r.answeredAt === null)!;
  if (!current.servedAt) {
    await db.update(schema.answers).set({ servedAt: new Date() }).where(eq(schema.answers.id, current.id));
  }
  const q = await questionForAnswerRow({ ...current, sessionSeed: session.seed });
  return {
    sessionId,
    status: session.status,
    kind: session.kind,
    score: session.score,
    question: toDto(q, current.optionOrder, current.position, rows.length, current.difficulty),
    /** Time already used on the current question (server clock). */
    elapsedMs: current.servedAt ? Date.now() - current.servedAt.getTime() : 0,
  };
}

async function ownSession(student: Student, sessionId: string) {
  const [session] = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, sessionId));
  if (!session || session.studentId !== student.id) throw new ApiError(404, "session_not_found");
  return session;
}

// ─── Answer ─────────────────────────────────────────────────────────────────────────────────

export async function submitAnswer(student: Student, sessionId: string, position: number, submitted: SubmittedAnswer) {
  await rateLimit("answer", student.id);
  const answeredAt = new Date();
  const session = await ownSession(student, sessionId);
  const [row] = await db
    .select()
    .from(schema.answers)
    .where(and(eq(schema.answers.sessionId, sessionId), eq(schema.answers.position, position)));
  if (!row || !row.servedAt) throw new ApiError(409, "question_not_served");

  const question = await questionForAnswerRow({ ...row, sessionSeed: session.seed });
  const limitMs = TIME_LIMIT_MS[question.type];

  // Idempotent retry (flaky 2G): the answer was already recorded — replay the same response.
  if (row.answeredAt) {
    return buildResponse(student, session.id, position, {
      correct: Boolean(row.isCorrect),
      timedOut: isTimedOut(row.timeMs ?? 0, limitMs),
      correctAnswer: correctDisplay(question.answer, row.optionOrder),
      explanation: question.explanation,
      points: row.points ?? 0,
      questionRef: row.questionId,
    });
  }
  if (session.status !== "active") throw new ApiError(409, "session_closed");

  const timeMs = serverElapsed(row.servedAt, answeredAt);
  const timedOut = isTimedOut(timeMs, limitMs);
  const correct = !timedOut && isCorrect(question.answer, submitted, row.optionOrder);
  const points = scoreAnswer({ correct, difficulty: row.difficulty, timeMs, limitMs, kind: session.kind });

  const recorded = await db.transaction(async (tx) => {
    // Conditional update guards against two concurrent submissions for the same question.
    const updated = await tx
      .update(schema.answers)
      .set({ answeredAt, submitted, isCorrect: correct, timeMs, points })
      .where(and(eq(schema.answers.id, row.id), sql`${schema.answers.answeredAt} is null`))
      .returning({ id: schema.answers.id });
    if (updated.length === 0) return false;
    await tx
      .update(schema.quizSessions)
      .set({
        score: sql`${schema.quizSessions.score} + ${points}`,
        correctCount: sql`${schema.quizSessions.correctCount} + ${correct ? 1 : 0}`,
        totalTimeMs: sql`${schema.quizSessions.totalTimeMs} + ${Math.min(timeMs, limitMs)}`,
      })
      .where(eq(schema.quizSessions.id, sessionId));
    await recordQuestionStats(tx, row, correct, timeMs);
    // The next question is NOT served here: its clock starts only when the client asks for it
    // (GET /api/quiz/:id), so time spent reading this feedback never counts against the student.
    return true;
  });
  if (!recorded) return submitAnswer(student, sessionId, position, submitted);

  return buildResponse(student, session.id, position, {
    correct,
    timedOut,
    correctAnswer: correctDisplay(question.answer, row.optionOrder),
    explanation: question.explanation,
    points,
    questionRef: row.questionId,
  });
}

async function recordQuestionStats(
  tx: Tx,
  row: { questionId: string | null; templateId: string | null },
  correct: boolean,
  timeMs: number,
) {
  const table = row.questionId ? schema.questions : schema.questionTemplates;
  const id = row.questionId ?? row.templateId!;
  await tx
    .update(table)
    .set({
      timesShown: sql`${table.timesShown} + 1`,
      timesCorrect: sql`${table.timesCorrect} + ${correct ? 1 : 0}`,
      totalTimeMs: sql`${table.totalTimeMs} + ${timeMs}`,
    })
    .where(eq(table.id, id));
}

async function buildResponse(student: Student, sessionId: string, position: number, feedback: FeedbackDto) {
  const [session] = await db.select().from(schema.quizSessions).where(eq(schema.quizSessions.id, sessionId));
  const [next] = await db
    .select()
    .from(schema.answers)
    .where(and(eq(schema.answers.sessionId, sessionId), eq(schema.answers.position, position + 1)));
  if (next) return { feedback, score: session!.score, hasNext: true as const };
  const summary = session!.status === "active" ? await finishSession(student, sessionId) : await summaryFor(student, sessionId);
  return { feedback, score: summary.score, hasNext: false as const, summary };
}

// ─── Finish ─────────────────────────────────────────────────────────────────────────────────

async function finishSession(student: Student, sessionId: string): Promise<SummaryDto> {
  const xpBefore = student.xp;
  const outcome = await db.transaction(async (tx) => {
    const closed = await tx
      .update(schema.quizSessions)
      .set({ status: "completed", finishedAt: new Date() })
      .where(and(eq(schema.quizSessions.id, sessionId), eq(schema.quizSessions.status, "active")))
      .returning();
    const session = closed[0];
    if (!session) return null; // finished concurrently

    const rows = await tx.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId));
    const flags = assessRound(rows.map((r) => ({ correct: Boolean(r.isCorrect), timeMs: r.timeMs ?? 0 })));
    const held = flags.length > 0;
    if (held) {
      await tx.update(schema.quizSessions).set({ held: true }).where(eq(schema.quizSessions.id, sessionId));
      await tx.insert(schema.anomalyFlags).values({
        kind: flags.join(","),
        entityType: "quiz_session",
        entityId: sessionId,
        detail: { studentId: student.id, score: session.score, times: rows.map((r) => r.timeMs) },
      });
    }
    const result = await award(tx, {
      studentId: student.id,
      amount: session.score,
      source: LEDGER_SOURCE[session.kind],
      held,
      refId: sessionId,
    });
    const streak = await touchStreak(tx, student.id);
    return { session, held, streak, awards: [{ amount: session.score, result }] };
  });
  if (!outcome) return summaryFor(student, sessionId);

  await afterCommit(student.id, outcome.awards);
  if (outcome.session.challengeId) {
    const { onChallengeSessionFinished } = await import("../challenges");
    await onChallengeSessionFinished(outcome.session.challengeId);
  }
  const [fresh] = await db.select({ xp: schema.students.xp }).from(schema.students).where(eq(schema.students.id, student.id));
  return {
    score: outcome.session.score,
    correct: outcome.session.correctCount,
    total: outcome.session.questionCount,
    held: outcome.held,
    streak: outcome.streak,
    xp: fresh!.xp,
    leveledUp: leveledUp(xpBefore, fresh!.xp),
    challengeId: outcome.session.challengeId,
  };
}

async function summaryFor(student: Student, sessionId: string): Promise<SummaryDto> {
  const session = await ownSession(student, sessionId);
  const [fresh] = await db
    .select({ xp: schema.students.xp, streak: schema.students.streakDays })
    .from(schema.students)
    .where(eq(schema.students.id, student.id));
  return {
    score: session.score,
    correct: session.correctCount,
    total: session.questionCount,
    held: session.held,
    streak: fresh!.streak,
    xp: fresh!.xp,
    leveledUp: false,
    challengeId: session.challengeId,
  };
}

/** Per-question review after a round (answers revealed only once the session is closed). */
export async function sessionReview(student: Student, sessionId: string) {
  const session = await ownSession(student, sessionId);
  if (session.status === "active") throw new ApiError(409, "session_active");
  const rows = await db.select().from(schema.answers).where(eq(schema.answers.sessionId, sessionId)).orderBy(asc(schema.answers.position));
  return Promise.all(
    rows.map(async (r) => {
      const q = await questionForAnswerRow({ ...r, sessionSeed: session.seed });
      return {
        position: r.position,
        prompt: q.prompt,
        options: q.type === "mcq" || q.type === "ordering" ? displayedOptions(q.options, r.optionOrder) : [],
        type: q.type,
        correct: Boolean(r.isCorrect),
        correctAnswer: correctDisplay(q.answer, r.optionOrder),
        explanation: q.explanation,
        points: r.points ?? 0,
        questionRef: r.questionId ?? null,
      };
    }),
  );
}
