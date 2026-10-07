/**
 * School Power — see PRD §3.5.
 *
 *   bayes = (C × m + Σpoints) / (C + activeStudents)
 *   bonus = min(activeStudents / enrolledEstimate, 1) × 0.10
 *   power = bayes × (1 + bonus)
 *
 * The Bayesian average pulls schools with few active students toward the population mean `m`,
 * so two lucky players cannot outrank a school where 300 students play every day. As
 * `activeStudents` grows the school's own average dominates. The participation bonus rewards
 * getting more of the school involved, capped at +10 %.
 */

export const DEFAULT_CONFIDENCE = 20;
export const PARTICIPATION_BONUS_CAP = 0.1;

export type SizeBand = "S" | "M" | "L" | "XL";
export type Stage = "primary" | "secondary";

/** Upper bounds (exclusive) for each size band, by number of enrolled learners. */
export const SIZE_BANDS: ReadonlyArray<{ band: SizeBand; min: number; max: number; midpoint: number }> = [
  { band: "S", min: 0, max: 300, midpoint: 150 },
  { band: "M", min: 300, max: 800, midpoint: 550 },
  { band: "L", min: 800, max: 1500, midpoint: 1150 },
  { band: "XL", min: 1500, max: Infinity, midpoint: 2000 },
];

export function sizeBandFor(enrolled: number): SizeBand {
  return (SIZE_BANDS.find((b) => enrolled >= b.min && enrolled < b.max) ?? SIZE_BANDS[0]!).band;
}

export function bandMidpoint(band: SizeBand): number {
  return SIZE_BANDS.find((b) => b.band === band)!.midpoint;
}

export interface SchoolPeriodStats {
  schoolId: string;
  /** Σ counted ledger points for the period. */
  points: number;
  /** Students with ≥ 1 counted ledger entry in the period. */
  activeStudents: number;
  /** Enrolled learners (official figure or size-band midpoint). */
  enrolledEstimate: number;
}

export interface SchoolPowerResult extends SchoolPeriodStats {
  bayes: number;
  participationBonus: number;
  power: number;
}

/** Mean points per active student across a population (the `m` in the formula). */
export function populationMean(stats: readonly SchoolPeriodStats[]): number {
  let points = 0;
  let active = 0;
  for (const s of stats) {
    points += s.points;
    active += s.activeStudents;
  }
  return active === 0 ? 0 : points / active;
}

export function participationBonus(activeStudents: number, enrolledEstimate: number): number {
  if (enrolledEstimate <= 0) return 0;
  return Math.min(activeStudents / enrolledEstimate, 1) * PARTICIPATION_BONUS_CAP;
}

export function schoolPower(
  s: SchoolPeriodStats,
  mean: number,
  confidence: number = DEFAULT_CONFIDENCE,
): SchoolPowerResult {
  if (s.activeStudents <= 0) {
    return { ...s, bayes: 0, participationBonus: 0, power: 0 };
  }
  const bayes = (confidence * mean + s.points) / (confidence + s.activeStudents);
  const bonus = participationBonus(s.activeStudents, s.enrolledEstimate);
  return { ...s, bayes, participationBonus: bonus, power: bayes * (1 + bonus) };
}

export interface RankedSchool extends SchoolPowerResult {
  rank: number;
}

/**
 * Rank a league. `m` is computed from `population` (pass the whole stage — e.g. all primary
 * schools nationally — even when ranking a single region or size band, so the prior is stable).
 * Schools with no active students are omitted. Ties share a rank (1, 2, 2, 4).
 */
export function rankSchools(
  league: readonly SchoolPeriodStats[],
  population: readonly SchoolPeriodStats[] = league,
  confidence: number = DEFAULT_CONFIDENCE,
): RankedSchool[] {
  const mean = populationMean(population);
  const scored = league
    .filter((s) => s.activeStudents > 0)
    .map((s) => schoolPower(s, mean, confidence))
    .sort((a, b) => b.power - a.power || b.activeStudents - a.activeStudents || a.schoolId.localeCompare(b.schoolId));
  return assignRanks(scored, (s) => s.power);
}

export function assignRanks<T>(sorted: readonly T[], score: (t: T) => number): (T & { rank: number })[] {
  let rank = 0;
  let prev: number | undefined;
  return sorted.map((item, i) => {
    const value = round6(score(item));
    if (value !== prev) {
      rank = i + 1;
      prev = value;
    }
    return { ...item, rank };
  });
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
