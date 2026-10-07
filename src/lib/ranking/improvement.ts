/** Weekly improvement awards — see PRD §3.5. */

export const MIN_ROUNDS_EACH_WEEK = 3;
export const MIN_ACTIVE_STUDENTS_EACH_WEEK = 5;

export interface StudentWeeks {
  studentId: string;
  thisWeekXp: number;
  lastWeekXp: number;
  thisWeekRounds: number;
  lastWeekRounds: number;
}

/**
 * Most Improved Student: largest absolute XP gain week-over-week, among students who were
 * genuinely active in *both* weeks — so returning from absence is not rewarded as "improvement".
 */
export function mostImprovedStudents(rows: readonly StudentWeeks[], limit = 3) {
  return rows
    .filter((r) => r.thisWeekRounds >= MIN_ROUNDS_EACH_WEEK && r.lastWeekRounds >= MIN_ROUNDS_EACH_WEEK)
    .map((r) => ({ ...r, gain: r.thisWeekXp - r.lastWeekXp }))
    .filter((r) => r.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.studentId.localeCompare(b.studentId))
    .slice(0, limit);
}

export interface SchoolWeeks {
  schoolId: string;
  powerNow: number;
  powerPrev: number;
  activeNow: number;
  activePrev: number;
}

/**
 * Most Improved School: largest *relative* School Power gain. The denominator is floored at the
 * population mean `m` so a school going from 0.5 to 5 does not register a 900 % jump.
 */
export function mostImprovedSchools(rows: readonly SchoolWeeks[], mean: number, limit = 3) {
  const floor = Math.max(mean, 1e-9);
  return rows
    .filter((r) => r.activeNow >= MIN_ACTIVE_STUDENTS_EACH_WEEK && r.activePrev >= MIN_ACTIVE_STUDENTS_EACH_WEEK)
    .map((r) => ({ ...r, gain: (r.powerNow - r.powerPrev) / Math.max(r.powerPrev, floor) }))
    .filter((r) => r.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.schoolId.localeCompare(b.schoolId))
    .slice(0, limit);
}
