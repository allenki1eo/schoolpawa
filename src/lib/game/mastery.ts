/** Topic mastery stars from a student's best round in that topic (out of 10 questions). */
export function starsFor(bestCorrect: number | null | undefined, total = 10): 0 | 1 | 2 | 3 {
  if (!bestCorrect || total <= 0) return 0;
  const ratio = bestCorrect / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.5) return 1;
  return 0;
}

/** Combo multiplier label for the quiz UI (purely cosmetic — scoring never depends on it). */
export function comboTier(run: number): 0 | 1 | 2 | 3 {
  if (run >= 8) return 3;
  if (run >= 5) return 2;
  if (run >= 3) return 1;
  return 0;
}
