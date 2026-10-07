/**
 * Calendar helpers pinned to East Africa Time (UTC+3, no DST). Streaks, daily challenges and
 * weekly boards all roll over at local midnight in Tanzania, never at UTC midnight.
 */
export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** YYYY-MM-DD in Africa/Dar_es_Salaam. */
export function localDate(at: Date = new Date()): string {
  return new Date(at.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the local week containing `at`. */
export function weekStart(at: Date = new Date()): string {
  const local = new Date(at.getTime() + EAT_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  local.setUTCDate(local.getUTCDate() - dow);
  return local.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days since an arbitrary epoch — used to rotate the daily challenge topic deterministically. */
export function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
}
