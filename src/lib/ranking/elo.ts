/** Elo rating for 1v1 challenges — see PRD §3.5. */

export const INITIAL_RATING = 1000;
export const K_PROVISIONAL = 40;
export const K_ESTABLISHED = 24;
export const PROVISIONAL_GAMES = 10;
export const RATING_FLOOR = 100;

export type Outcome = 1 | 0.5 | 0;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < PROVISIONAL_GAMES ? K_PROVISIONAL : K_ESTABLISHED;
}

export interface Player {
  rating: number;
  games: number;
}

/** Returns both players' new ratings. `outcomeA` is A's result: 1 win, 0.5 draw, 0 loss. */
export function updateElo(a: Player, b: Player, outcomeA: Outcome): { a: number; b: number } {
  const ea = expectedScore(a.rating, b.rating);
  const eb = 1 - ea;
  const outcomeB = (1 - outcomeA) as Outcome;
  return {
    a: Math.max(RATING_FLOOR, Math.round(a.rating + kFactor(a.games) * (outcomeA - ea))),
    b: Math.max(RATING_FLOOR, Math.round(b.rating + kFactor(b.games) * (outcomeB - eb))),
  };
}

/** Decide a 1v1: higher score wins; equal scores → faster total time wins; otherwise draw. */
export function decideChallenge(
  a: { score: number; totalTimeMs: number },
  b: { score: number; totalTimeMs: number },
): Outcome {
  if (a.score !== b.score) return a.score > b.score ? 1 : 0;
  if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs < b.totalTimeMs ? 1 : 0;
  return 0.5;
}
