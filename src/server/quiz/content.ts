import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createRng, type Rng } from "@/lib/quiz/rng";
import { render, variantSpace, type TemplateSpec } from "@/lib/quiz/template";
import type { Candidate, ConcreteQuestion, Difficulty } from "@/lib/quiz/types";
import { config } from "../config";

export const TEMPLATE_POOL_WEIGHT = 10;
export const MIN_PER_DIFFICULTY = 10;

/** All approved, selectable items for a topic, as selector candidates. */
export async function candidatesFor(topicId: string): Promise<Candidate[]> {
  const [qs, ts] = await Promise.all([
    db
      .select({ id: schema.questions.id, difficulty: schema.questions.difficulty, subTopic: schema.questions.subTopic })
      .from(schema.questions)
      .where(and(eq(schema.questions.topicId, topicId), eq(schema.questions.status, "approved"))),
    db
      .select({ id: schema.questionTemplates.id, difficulty: schema.questionTemplates.difficulty, subTopic: schema.questionTemplates.subTopic })
      .from(schema.questionTemplates)
      .where(and(eq(schema.questionTemplates.topicId, topicId), eq(schema.questionTemplates.status, "approved"))),
  ]);
  return [
    ...qs.map((q) => ({ key: `q:${q.id}`, difficulty: q.difficulty as Difficulty, subTopic: q.subTopic })),
    ...ts.map((t) => ({ key: `t:${t.id}`, difficulty: t.difficulty as Difficulty, subTopic: t.subTopic })),
  ];
}

/**
 * PRD §4.1 pool-size rule: effective pool ≥ TOPIC_LIVE_MIN with ≥ 10 per difficulty
 * (scaled down proportionally when the dev threshold is lowered). Templates count as
 * min(variantSpace, 10).
 */
export async function poolStats(topicId: string) {
  const [qs, ts] = await Promise.all([
    db
      .select({ difficulty: schema.questions.difficulty })
      .from(schema.questions)
      .where(and(eq(schema.questions.topicId, topicId), eq(schema.questions.status, "approved"))),
    db
      .select({ difficulty: schema.questionTemplates.difficulty, spec: schema.questionTemplates.spec })
      .from(schema.questionTemplates)
      .where(and(eq(schema.questionTemplates.topicId, topicId), eq(schema.questionTemplates.status, "approved"))),
  ]);
  const byDifficulty: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0 };
  for (const q of qs) byDifficulty[q.difficulty as Difficulty] += 1;
  for (const t of ts) byDifficulty[t.difficulty as Difficulty] += Math.min(variantSpace(t.spec), TEMPLATE_POOL_WEIGHT);
  const total = byDifficulty[1] + byDifficulty[2] + byDifficulty[3];
  const perDifficultyMin = Math.max(1, Math.round((MIN_PER_DIFFICULTY * config.TOPIC_LIVE_MIN) / 60));
  const live = total >= config.TOPIC_LIVE_MIN && [1, 2, 3].every((d) => byDifficulty[d as Difficulty] >= perDifficultyMin);
  return { byDifficulty, total, live, required: config.TOPIC_LIVE_MIN, perDifficultyMin };
}

/** Recompute `topics.is_live` (after approvals, retirements and flags). */
export async function refreshTopicLiveness(topicId: string) {
  const { live } = await poolStats(topicId);
  await db.update(schema.topics).set({ isLive: live }).where(eq(schema.topics.id, topicId));
  return live;
}

export interface ItemSource {
  difficulty: Difficulty;
  subTopic: string;
  staticQ?: ConcreteQuestion;
  spec?: TemplateSpec;
}

/** Fetch the raw content behind candidate keys ("q:<id>" / "t:<id>"). */
export async function loadSources(keys: readonly string[]): Promise<Map<string, ItemSource>> {
  const qIds = keys.filter((k) => k.startsWith("q:")).map((k) => k.slice(2));
  const tIds = keys.filter((k) => k.startsWith("t:")).map((k) => k.slice(2));
  const [qs, ts] = await Promise.all([
    qIds.length ? db.select().from(schema.questions).where(inArray(schema.questions.id, qIds)) : [],
    tIds.length ? db.select().from(schema.questionTemplates).where(inArray(schema.questionTemplates.id, tIds)) : [],
  ]);
  const out = new Map<string, ItemSource>();
  for (const q of qs) {
    out.set(`q:${q.id}`, {
      difficulty: q.difficulty as Difficulty,
      subTopic: q.subTopic,
      staticQ: { type: q.type, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation },
    });
  }
  for (const t of ts) out.set(`t:${t.id}`, { difficulty: t.difficulty as Difficulty, subTopic: t.subTopic, spec: t.spec });
  return out;
}

/** RNG stream used to render template item `position` of a session — shared by serve and grade. */
export function renderRng(seed: string, position: number): Rng {
  return createRng(seed).fork(`render:${position}`);
}

/** Concrete question for a stored answer row (static question or template + params). */
export async function questionForAnswerRow(row: {
  questionId: string | null;
  templateId: string | null;
  params: Record<string, number> | null;
  sessionSeed: string;
  position: number;
}): Promise<ConcreteQuestion> {
  if (row.questionId) {
    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, row.questionId));
    if (!q) throw new Error("Question missing");
    return { type: q.type, prompt: q.prompt, options: q.options, answer: q.answer, explanation: q.explanation };
  }
  const [t] = await db.select().from(schema.questionTemplates).where(eq(schema.questionTemplates.id, row.templateId!));
  if (!t || !row.params) throw new Error("Template missing");
  return render(t.spec, row.params, renderRng(row.sessionSeed, row.position));
}
