import { BLOCKED_SUBSTRINGS, BLOCKED_WORDS, IDENTITY_HINTS } from "./wordlist";

export type NameProblem =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "blocked_word"
  | "contact_info"
  | "identity_hint";

export interface NameCheck {
  ok: boolean;
  problem?: NameProblem;
  /** Trimmed, whitespace-collapsed display value (only meaningful when ok). */
  value: string;
}

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s",
  "7": "t", "8": "b", "9": "g", "+": "t", "€": "e",
};

/**
 * Canonical form used for matching: lower-case, accents stripped, leetspeak mapped, everything
 * that is not a letter removed, and runs of the same letter collapsed ("fuuuck" → "fuck").
 */
export function normalizeForMatch(input: string): string {
  const lowered = input.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  let out = "";
  for (const ch of lowered) out += LEET[ch] ?? ch;
  return out.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

function words(input: string): string[] {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9@$!|+€]+/)
    .filter(Boolean)
    .map((w) => normalizeForMatch(w));
}

/** Collapse a term the same way input is collapsed so "mavi" and "kahaba" still match. */
const collapse = (t: string) => normalizeForMatch(t);

export function containsBlocked(input: string, extra: readonly string[] = []): boolean {
  const flat = normalizeForMatch(input);
  if ([...BLOCKED_SUBSTRINGS, ...extra].some((t) => flat.includes(collapse(t)))) return true;
  const ws = new Set(words(input));
  return BLOCKED_WORDS.some((w) => ws.has(collapse(w)));
}

/** Phone numbers, URLs, handles: contact details must never appear in names (child safety). */
export function containsContactInfo(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  if (digits.length >= 5) return true;
  return /(https?:|www\.|\.com|\.co\.tz|\.tz\b|@|wa\.me|t\.me|instagram|tiktok|facebook|snapchat|whatsapp)/i.test(input);
}

export interface NameRules {
  min: number;
  max: number;
  extraBlocked?: readonly string[];
  /** Disallow words like "shule" that suggest identifying info (nicknames only). */
  forbidIdentityHints?: boolean;
}

export const NICKNAME_RULES: NameRules = { min: 3, max: 16, forbidIdentityHints: true };
export const GROUP_NAME_RULES: NameRules = { min: 3, max: 24 };

/** Letters (incl. accented), digits, single spaces, - _ . and a few safe emoji are allowed. */
const ALLOWED = /^[\p{L}\p{N} _.\-]+$/u;

export function checkName(raw: string, rules: NameRules): NameCheck {
  const value = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (value.length < rules.min) return { ok: false, problem: "too_short", value };
  if (value.length > rules.max) return { ok: false, problem: "too_long", value };
  if (!ALLOWED.test(value)) return { ok: false, problem: "invalid_chars", value };
  if (containsContactInfo(value)) return { ok: false, problem: "contact_info", value };
  if (containsBlocked(value, rules.extraBlocked)) return { ok: false, problem: "blocked_word", value };
  if (rules.forbidIdentityHints) {
    const flat = normalizeForMatch(value);
    if (IDENTITY_HINTS.some((h) => flat.includes(h))) return { ok: false, problem: "identity_hint", value };
  }
  return { ok: true, value };
}
