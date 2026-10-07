import type { Rng } from "./rng";
import type { Candidate, Difficulty, SeenInfo } from "./types";

/** Accuracy assumed for a student with no history yet. */
export const DEFAULT_ACCURACY = 0.6;

/**
 * Target share of easy/medium/hard questions for a given recent accuracy (0..1).
 * Linear interpolation: weak students get mostly easy questions, strong students mostly hard,
 * and medium stays at 35 % so every round has a solid core.
 */
export function difficultyMix(accuracy: number | null | undefined): [number, number, number] {
  const a = clamp01(accuracy ?? DEFAULT_ACCURACY);
  const easy = 0.55 - 0.4 * a;
  const hard = 0.1 + 0.4 * a;
  return [easy, 1 - easy - hard, hard];
}

export interface SelectionInput {
  candidates: readonly Candidate[];
  /** Keyed by candidate key. Anything missing is unseen. */
  seen: ReadonlyMap<string, SeenInfo>;
  /** Accuracy over the student's recent answers (null when no history). */
  accuracy: number | null;
  count: number;
  rng: Rng;
}

/**
 * Pick `count` questions for a round.
 *
 * Guarantees:
 *  1. Unseen candidates are always used before any seen candidate.
 *  2. When unseen run out, seen candidates are recycled oldest-first: only the oldest
 *     `2 × slotsLeft` remaining seen items are eligible, so the mix rules below still have room
 *     to work without ever reaching for a recently-seen question.
 *  3. Each slot draws a target difficulty from `difficultyMix(accuracy)`, falling back to the
 *     nearest difficulty that still has candidates.
 *  4. Within a difficulty, the least-used sub-topic so far wins (random tie-break), so a round
 *     samples across the topic instead of clustering.
 *  5. No candidate appears twice, except templates (`t:` keys), which may repeat to fill a round
 *     when the distinct pool is smaller than `count` — each instance gets fresh parameters.
 */
export function selectQuestions(input: SelectionInput): Candidate[] {
  const { candidates, seen, accuracy, count, rng } = input;
  if (count <= 0 || candidates.length === 0) return [];

  const mix = difficultyMix(accuracy);
  const unseen = candidates.filter((c) => !seen.has(c.key));
  const seenOldestFirst = candidates
    .filter((c) => seen.has(c.key))
    .sort((a, b) => seen.get(a.key)!.lastSeenAt - seen.get(b.key)!.lastSeenAt);

  const picked: Candidate[] = [];
  const pickedKeys = new Set<string>();
  const subTopicUse = new Map<string, number>();

  const take = (c: Candidate) => {
    picked.push(c);
    pickedKeys.add(c.key);
    subTopicUse.set(c.subTopic, (subTopicUse.get(c.subTopic) ?? 0) + 1);
  };

  while (picked.length < count) {
    const slotsLeft = count - picked.length;
    let pool = unseen.filter((c) => !pickedKeys.has(c.key));
    if (pool.length === 0) {
      pool = seenOldestFirst.filter((c) => !pickedKeys.has(c.key)).slice(0, slotsLeft * 2);
    }
    if (pool.length === 0) {
      // Distinct pool exhausted: only templates may repeat.
      pool = candidates.filter((c) => c.key.startsWith("t:"));
      if (pool.length === 0) break;
    }

    const target = (rng.weightedIndex(mix) + 1) as Difficulty;
    const byDifficulty = nearestDifficulty(pool, target);
    const chosen = leastUsedSubTopic(byDifficulty, subTopicUse, rng);
    take(chosen);
  }

  return rng.shuffle(picked);
}

function nearestDifficulty(pool: readonly Candidate[], target: Difficulty): Candidate[] {
  const order: Difficulty[] =
    target === 1 ? [1, 2, 3] : target === 3 ? [3, 2, 1] : [2, 1, 3];
  for (const d of order) {
    const match = pool.filter((c) => c.difficulty === d);
    if (match.length > 0) return match;
  }
  return pool.slice();
}

function leastUsedSubTopic(
  pool: readonly Candidate[],
  use: ReadonlyMap<string, number>,
  rng: Rng,
): Candidate {
  let min = Infinity;
  for (const c of pool) min = Math.min(min, use.get(c.subTopic) ?? 0);
  const best = pool.filter((c) => (use.get(c.subTopic) ?? 0) === min);
  return rng.pick(best);
}

/**
 * Head-to-head: both players receive the same question set, each in their own order.
 * Returns the permutation of `keys` for one player from that player's RNG stream.
 */
export function orderForPlayer<T>(items: readonly T[], playerRng: Rng): T[] {
  return playerRng.shuffle(items);
}

/** Accuracy over the most recent answers (newest first), or null with too little history. */
export function recentAccuracy(results: readonly boolean[], window = 30, minimum = 5): number | null {
  const slice = results.slice(0, window);
  if (slice.length < minimum) return null;
  return slice.filter(Boolean).length / slice.length;
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : DEFAULT_ACCURACY;
}
