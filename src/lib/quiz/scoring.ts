import type { Difficulty, QuestionType } from "./types";

export const QUESTIONS_PER_ROUND = 10;

/** Per-question time limits in milliseconds. */
export const TIME_LIMIT_MS: Record<QuestionType, number> = {
  mcq: 25_000,
  true_false: 20_000,
  number: 45_000,
  ordering: 50_000,
};

/** Network/render grace before an answer is treated as a timeout. */
export const TIME_GRACE_MS = 3_000;

export const BASE_POINTS = 10;
export const MAX_SPEED_BONUS = 5;
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { 1: 1, 2: 1.3, 3: 1.6 };

export type RoundKind = "practice" | "daily" | "challenge" | "offline";
export const KIND_MULTIPLIER: Record<RoundKind, number> = {
  practice: 1,
  daily: 1.5,
  challenge: 1,
  offline: 0.5,
};

export const CHALLENGE_WIN_BONUS = 30;
export const CHALLENGE_DRAW_BONUS = 15;

export interface AnswerScoreInput {
  correct: boolean;
  difficulty: Difficulty;
  timeMs: number;
  limitMs: number;
  kind: RoundKind;
}

/** Points for one answer. Incorrect or late answers score zero. */
export function scoreAnswer({ correct, difficulty, timeMs, limitMs, kind }: AnswerScoreInput): number {
  if (!correct || timeMs > limitMs + TIME_GRACE_MS) return 0;
  const speed = Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - timeMs / limitMs));
  const raw = BASE_POINTS * DIFFICULTY_MULTIPLIER[difficulty] + speed;
  return Math.round(raw * KIND_MULTIPLIER[kind]);
}

/** Server-side answer time, clamped to sane bounds. */
export function serverElapsed(servedAt: Date, answeredAt: Date): number {
  return Math.max(0, answeredAt.getTime() - servedAt.getTime());
}

export function isTimedOut(timeMs: number, limitMs: number): boolean {
  return timeMs > limitMs + TIME_GRACE_MS;
}
