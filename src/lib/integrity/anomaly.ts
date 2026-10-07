/**
 * Integrity heuristics — see PRD §5. Pure functions; the server decides what to do with a flag
 * (usually: write the round's points to the ledger with status `held`).
 */

export const MIN_HUMAN_MS = 1_200;
export const MIN_ANSWERS_FOR_TIMING = 8;
export const MIN_TIMING_CV = 0.05;

export type RoundFlag = "impossibly_fast" | "robotic_timing";

export interface TimedAnswer {
  correct: boolean;
  timeMs: number;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Coefficient of variation (stddev / mean). */
export function coefficientOfVariation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/** Flags for one completed round. Empty array = clean. */
export function assessRound(answers: readonly TimedAnswer[]): RoundFlag[] {
  const flags: RoundFlag[] = [];
  if (answers.length === 0) return flags;
  const times = answers.map((a) => a.timeMs);
  const perfect = answers.every((a) => a.correct);
  if (perfect && median(times) < MIN_HUMAN_MS) flags.push("impossibly_fast");
  if (answers.length >= MIN_ANSWERS_FOR_TIMING && coefficientOfVariation(times) < MIN_TIMING_CV) {
    flags.push("robotic_timing");
  }
  return flags;
}

export const SPIKE_MULTIPLIER = 4;
export const SPIKE_MIN_POINTS = 500;

/** Weekly school points far above the trailing average. */
export function isSchoolSpike(thisWeek: number, trailingWeeks: readonly number[]): boolean {
  if (thisWeek < SPIKE_MIN_POINTS) return false;
  if (trailingWeeks.length === 0) return false;
  const mean = trailingWeeks.reduce((a, b) => a + b, 0) / trailingWeeks.length;
  return thisWeek > SPIKE_MULTIPLIER * Math.max(mean, 1);
}

export const DEVICE_PROFILE_BURST = 3;

/** Too many profiles created on one device within 24 h. */
export function isDeviceBurst(profileCreatedAt: readonly Date[], now: Date): boolean {
  const dayAgo = now.getTime() - 86_400_000;
  return profileCreatedAt.filter((d) => d.getTime() >= dayAgo).length > DEVICE_PROFILE_BURST;
}

export const QUESTION_MIN_SHOWS = 50;

/** Per-question stats check: likely wrong answer key, or trivially easy. */
export function questionHealth(timesShown: number, timesCorrect: number): "ok" | "suspect_key" | "too_easy" {
  if (timesShown < QUESTION_MIN_SHOWS) return "ok";
  const acc = timesCorrect / timesShown;
  if (acc < 0.15) return "suspect_key";
  if (acc > 0.97) return "too_easy";
  return "ok";
}
