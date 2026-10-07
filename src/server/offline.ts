import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createRng, newSeed } from "@/lib/quiz/rng";
import { scoreAnswer, TIME_LIMIT_MS } from "@/lib/quiz/scoring";
import { selectQuestions } from "@/lib/quiz/selection";
import { isCorrect } from "@/lib/quiz/shuffle";
import { instantiate, render } from "@/lib/quiz/template";
import type { ConcreteQuestion, SubmittedAnswer } from "@/lib/quiz/types";
import type { ChallengeItem } from "@/db/schema";
import { localDate } from "@/lib/time";
import { config } from "./config";
import { ApiError } from "./http";
import { afterCommit, award, touchStreak } from "./ledger";
import { candidatesFor, loadSources } from "./quiz/content";

/**
 * Offline packs (PRD §9.3).
 *
 * Trade-off, documented: to grade instantly with no connection the pack must carry answers
 * on-device. Offline results are therefore *re-graded on the server* against its own copy of the
 * pack, earn half points with no speed bonus (client clocks are untrusted), are capped per day,
 * count once per pack, and never count toward the Daily Challenge or 1v1.
 */

export const PACK_SIZE = 20;
export const PACK_MAX_AGE_DAYS = 14;

export interface PackQuestion extends ConcreteQuestion {
  index: number;
  difficulty: 1 | 2 | 3;
}

export interface Pack {
  packId: string | null;
  topicId: string;
  issuedAt: string;
  questions: PackQuestion[];
}

async function buildItems(topicId: string): Promise<{ items: ChallengeItem[]; questions: PackQuestion[] }> {
  const seed = newSeed();
  const rng = createRng(seed);
  const picked = selectQuestions({ candidates: await candidatesFor(topicId), seen: new Map(), accuracy: null, count: PACK_SIZE, rng: rng.fork("select") });
  const sources = await loadSources(picked.map((p) => p.key));
  const items: ChallengeItem[] = [];
  const questions: PackQuestion[] = [];
  picked.forEach((p, index) => {
    const src = sources.get(p.key)!;
    let q: ConcreteQuestion;
    let params: Record<string, number> | undefined;
    if (src.spec) {
      params = instantiate(src.spec, rng.fork(`inst:${index}`)).params;
      q = render(src.spec, params, createRng(seed).fork(`render:${index}`));
    } else q = src.staticQ!;
    items.push({ key: p.key, difficulty: p.difficulty, params });
    questions.push({ ...q, index, difficulty: p.difficulty });
  });
  return { items, questions };
}

/** Signed-in students get a recorded pack (syncable). */
export async function issuePack(studentId: string, gradeLevelId: string, topicId: string): Promise<Pack> {
  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.id, topicId));
  if (!topic?.isLive || topic.gradeLevelId !== gradeLevelId) throw new ApiError(404, "topic_unavailable");
  const { items, questions } = await buildItems(topicId);
  const [pack] = await db.insert(schema.offlinePacks).values({ studentId, topicId, items }).returning();
  return { packId: pack!.id, topicId, issuedAt: pack!.issuedAt.toISOString(), questions };
}

/**
 * Anonymous starter pack for profiles awaiting parental consent. Nothing is recorded and the
 * results can never be synced — consistent with "nothing uploaded before consent".
 */
export async function starterPack(gradeLevelId: string): Promise<Pack | null> {
  const [topic] = await db
    .select()
    .from(schema.topics)
    .where(and(eq(schema.topics.gradeLevelId, gradeLevelId), eq(schema.topics.isLive, true)))
    .orderBy(schema.topics.sortOrder)
    .limit(1);
  if (!topic) return null;
  const { questions } = await buildItems(topic.id);
  return { packId: null, topicId: topic.id, issuedAt: new Date().toISOString(), questions: questions.slice(0, 10) };
}

export interface OfflineResult {
  clientResultId: string;
  packId: string;
  answers: Array<{ index: number; answer: SubmittedAnswer }>;
}

export async function syncResult(student: typeof schema.students.$inferSelect, result: OfflineResult) {
  const [existing] = await db.select().from(schema.offlineResults).where(eq(schema.offlineResults.clientResultId, result.clientResultId));
  if (existing) return { points: existing.points, duplicate: true };

  const [pack] = await db.select().from(schema.offlinePacks).where(eq(schema.offlinePacks.id, result.packId));
  if (!pack || pack.studentId !== student.id) throw new ApiError(404, "pack_not_found");
  if (pack.issuedAt.getTime() < Date.now() - PACK_MAX_AGE_DAYS * 86_400_000) throw new ApiError(410, "pack_expired");
  const [alreadyCounted] = await db.select().from(schema.offlineResults).where(eq(schema.offlineResults.packId, pack.id));

  const sources = await loadSources(pack.items.map((i) => i.key));
  let raw = 0;
  const seenIndexes = new Set<number>();
  for (const a of result.answers) {
    const item = pack.items[a.index];
    if (!item || seenIndexes.has(a.index)) continue;
    seenIndexes.add(a.index);
    const src = sources.get(item.key);
    if (!src) continue;
    const q = src.spec ? render(src.spec, item.params!, createRng("00".repeat(32))) : src.staticQ!;
    const identity = q.options.map((_, i) => i);
    const correct = isCorrect(q.answer, a.answer, identity);
    const limitMs = TIME_LIMIT_MS[q.type];
    raw += scoreAnswer({ correct, difficulty: item.difficulty, timeMs: limitMs, limitMs, kind: "offline" });
  }

  // Daily cap across all offline syncs (local calendar day).
  const today = localDate();
  const [todayTotal] = await db
    .select({ sum: sql<number>`coalesce(sum(${schema.offlineResults.points}), 0)`.mapWith(Number) })
    .from(schema.offlineResults)
    .where(and(eq(schema.offlineResults.studentId, student.id), gte(schema.offlineResults.syncedAt, new Date(`${today}T00:00:00+03:00`))));
  const remaining = Math.max(0, config.OFFLINE_DAILY_POINT_CAP - (todayTotal?.sum ?? 0));
  const points = alreadyCounted ? 0 : Math.min(raw, remaining);

  const outcome = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.offlineResults)
      .values({ clientResultId: result.clientResultId, studentId: student.id, packId: pack.id, points })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) return null;
    const r = await award(tx, { studentId: student.id, amount: points, source: "offline", refId: result.clientResultId });
    await touchStreak(tx, student.id);
    return r;
  });
  if (outcome) await afterCommit(student.id, [{ amount: points, result: outcome }]);
  return { points, duplicate: false, capped: points < raw };
}
