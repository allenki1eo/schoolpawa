/** Student levels — see PRD §3.5. Keys are stable; labels come from i18n. */

export const LEVELS = [
  { key: "mwanafunzi", minXp: 0 },
  { key: "shujaa", minXp: 500 },
  { key: "bingwa", minXp: 2000 },
  { key: "gwiji", minXp: 6000 },
] as const;

export type LevelKey = (typeof LEVELS)[number]["key"];

export interface LevelProgress {
  key: LevelKey;
  index: number;
  next: LevelKey | null;
  /** 0..1 progress toward the next level (1 at max level). */
  progress: number;
  xpToNext: number;
}

export function levelFor(xp: number): LevelProgress {
  const safe = Math.max(0, xp);
  let index = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (safe >= LEVELS[i]!.minXp) {
      index = i;
      break;
    }
  }
  const current = LEVELS[index]!;
  const nextLevel = LEVELS[index + 1];
  if (!nextLevel) return { key: current.key, index, next: null, progress: 1, xpToNext: 0 };
  const span = nextLevel.minXp - current.minXp;
  return {
    key: current.key,
    index,
    next: nextLevel.key,
    progress: (safe - current.minXp) / span,
    xpToNext: nextLevel.minXp - safe,
  };
}

/** Did this XP gain cross a level boundary? (drives the rank-up animation) */
export function leveledUp(before: number, after: number): boolean {
  return levelFor(after).index > levelFor(before).index;
}

/**
 * Consecutive-day streak update. Dates are YYYY-MM-DD strings in Africa/Dar_es_Salaam.
 * Same day → unchanged; next day → +1; gap → reset to 1.
 */
export function nextStreak(current: number, lastActive: string | null, today: string): number {
  if (!lastActive) return 1;
  if (lastActive === today) return Math.max(1, current);
  const diffDays = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastActive}T00:00:00Z`)) / 86_400_000);
  return diffDays === 1 ? current + 1 : 1;
}
