/**
 * Blocked terms for nicknames and group names (Kiswahili + English).
 *
 * Kept deliberately broad because the audience is children: insults, sexual terms, slurs and
 * drug references. Matching is done on a normalised form (see profanity.ts) so leetspeak,
 * repeated letters, spaces and punctuation do not bypass it.
 *
 * Moderators extend this list via the `BLOCKED_TERMS_EXTRA` config (comma-separated) without a
 * deploy; reported names that slip through are fed back here in the next release.
 */

/** Matched anywhere inside the normalised text. Use for terms that are unambiguous substrings. */
export const BLOCKED_SUBSTRINGS: readonly string[] = [
  // Kiswahili
  "malaya", "kahaba", "msenge", "mshenzi", "washenzi", "pumbavu", "mpumbavu", "kumamako", "kumanyoko",
  "nyoko", "mkundu", "matako", "mboro", "kisimi", "kutomba", "tomba", "tombwa", "bwege", "mavi",
  "kichaa", "mjinga", "wajinga", "shoga", "mbwakoko", "mbususu", "punyeto", "ngono", "mkojo",
  // English
  "fuck", "shit", "bitch", "bastard", "asshole", "pussy", "cunt", "whore", "slut", "porn",
  "sex", "nigger", "nigga", "faggot", "retard", "penis", "vagina", "boobs", "cocaine",
  "suicide", "hitler",
  // Note: "nazi" is deliberately absent — it is Kiswahili for coconut.
];

/** Matched only as whole words (to avoid blocking innocent names containing these letters). */
export const BLOCKED_WORDS: readonly string[] = [
  // "dick" is a word-match only: Dickson is a common name in Tanzania.
  "kuma", "ass", "cock", "fag", "hoe", "tits", "jinga", "mbwa", "nguruwe", "fala", "dick", "rape",
  "kill", "weed", "uchi", "bangi",
];

/**
 * Words that look like identifying information — kids are told not to use their real name,
 * school or phone number in a nickname. These are not offensive, just not allowed.
 */
export const IDENTITY_HINTS: readonly string[] = ["shule", "school", "sekondari", "secondary", "primary", "msingi"];
