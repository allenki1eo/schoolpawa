/**
 * Human-friendly codes. The alphabet drops look-alikes (0/O, 1/I/L) because codes are read
 * aloud in class and typed on small keyboards.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** `randomInt(maxExclusive)` must be a CSPRNG (crypto.randomInt on the server). */
export function generateCode(length: number, randomInt: (maxExclusive: number) => number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

/** Normalise user input: upper-case, strip spaces and dashes. Look-alikes simply fail validation. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidCode(code: string, length: number): boolean {
  return code.length === length && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** Handle = nickname + 4-digit discriminator, e.g. "Simba#4821". */
export function formatHandle(nickname: string, discriminator: number): string {
  return `${nickname}#${String(discriminator).padStart(4, "0")}`;
}

export function parseHandle(input: string): { nickname: string; discriminator: number } | null {
  const m = /^\s*(.+?)\s*#\s*(\d{4})\s*$/.exec(input);
  if (!m) return null;
  return { nickname: m[1]!, discriminator: Number(m[2]) };
}

/**
 * Normalise a Tanzanian mobile number to E.164 (+255XXXXXXXXX). Accepts 07XX…, 06XX…, 255…,
 * +255…, with spaces/dashes. Returns null for anything that is not a valid TZ mobile number.
 */
export function normalizeTzPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^255\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  else return null;
  // Mobile ranges start with 6 or 7.
  if (!/^[67]\d{8}$/.test(national)) return null;
  return `+255${national}`;
}

/** "+255712345678" → "+255 7•• ••• 678" for display (never show full numbers in UI). */
export function maskPhone(e164: string): string {
  return `${e164.slice(0, 4)} ${e164[4]}•• ••• ${e164.slice(-3)}`;
}
