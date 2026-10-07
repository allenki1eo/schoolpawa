/**
 * Preset interactions — the ONLY way students communicate (PRD §3.4, §7.2).
 * Keys are stored in the database; text is rendered from i18n. Adding an entry here requires a
 * matching key in both dictionaries (enforced by the i18n types).
 */

export const REACTIONS = {
  fire: "🔥",
  clap: "👏",
  strong: "💪",
  trophy: "🏆",
  laugh: "😂",
} as const;
export type ReactionKey = keyof typeof REACTIONS;

export const PRESET_MESSAGES = [
  "coming_for_you",
  "congrats",
  "well_played",
  "rematch",
  "lets_go_team",
  "practice_today",
] as const;
export type PresetMessageKey = (typeof PRESET_MESSAGES)[number];

export const REPORT_REASONS = ["bad_name", "bullying", "cheating", "personal_info", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const QUESTION_FLAG_REASONS = ["wrong_answer", "typo", "unclear", "offensive"] as const;
export type QuestionFlagReason = (typeof QUESTION_FLAG_REASONS)[number];

export const AVATARS = [
  "simba", "twiga", "tembo", "chui", "duma", "pundamilia", "kiboko", "faru", "tai", "kasuku", "kobe", "pomboo",
] as const;
export type AvatarKey = (typeof AVATARS)[number];

export const GROUP_EMBLEMS = ["ngao", "nyota", "mwenge", "radi", "taji", "mlima", "jua", "moto"] as const;
export type GroupEmblemKey = (typeof GROUP_EMBLEMS)[number];

export function isReaction(k: string): k is ReactionKey {
  return Object.hasOwn(REACTIONS, k);
}
export function isPresetMessage(k: string): k is PresetMessageKey {
  return (PRESET_MESSAGES as readonly string[]).includes(k);
}
