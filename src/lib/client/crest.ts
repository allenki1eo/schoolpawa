/** Deterministic crest design from a school's name + registration number (no real logos). */

const STOP_WORDS = new Set(["primary", "secondary", "school", "shule", "ya", "msingi", "sekondari", "english", "medium", "the", "of", "pre", "and", "na"]);

export function schoolInitials(name: string): string {
  const words = name
    .split(/[\s\-.,]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  const picked = (words.length ? words : name.split(/\s+/)).slice(0, 2);
  return picked.map((w) => w[0]!.toUpperCase()).join("") || "S";
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type CrestPattern = "chevron" | "stripes" | "split" | "star" | "band";
const PATTERNS: CrestPattern[] = ["chevron", "stripes", "split", "star", "band"];

export function crestDesign(name: string, regNo: string) {
  const h = hashString(regNo);
  return {
    initials: schoolInitials(name),
    pattern: PATTERNS[h % PATTERNS.length]!,
    rotate: (h >> 4) % 2 === 0,
  };
}
