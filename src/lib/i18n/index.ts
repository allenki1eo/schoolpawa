import { en } from "./en";
import { sw, type Dictionary } from "./sw";

export type Locale = "sw" | "en";
export const LOCALES: readonly Locale[] = ["sw", "en"];
export const DEFAULT_LOCALE: Locale = "sw";
export const LOCALE_COOKIE = "sp_locale";

export const dictionaries: Record<Locale, Dictionary> = { sw, en };
export type { Dictionary };

export function isLocale(v: unknown): v is Locale {
  return v === "sw" || v === "en";
}

/** Replace {name} placeholders. Unknown placeholders are left visible to catch mistakes. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

/** Pick the localized field from a bilingual DB row ({ nameSw, nameEn } etc.). */
export function pick<T extends Record<string, unknown>>(row: T, base: string, locale: Locale): string {
  const key = `${base}${locale === "sw" ? "Sw" : "En"}`;
  return String(row[key] ?? row[`${base}Sw`] ?? "");
}

/** Human message for an API error code. */
export function errorMessage(dict: Dictionary, code: string | undefined, vars?: Record<string, string | number>): string {
  const msg = code ? (dict.errors as Record<string, string>)[code] : undefined;
  return fmt(msg ?? dict.errors.generic, vars);
}
