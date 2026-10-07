import "server-only";
import { z } from "zod";

/**
 * The only place that reads `process.env`. Validated once at boot so misconfiguration fails
 * loudly instead of silently weakening privacy (e.g. an empty phone pepper).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Deployment environment. Distinct from NODE_ENV, which is "production" for every `next build`. */
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional().default(""),
  APP_URL: z.string().url().default("http://localhost:3000"),

  SESSION_SECRET: z.string().min(32),
  PHONE_HASH_PEPPER: z.string().min(32),
  CRON_SECRET: z.string().min(8),

  DATA_RESIDENCY: z.string().default("tz"),
  DB_REGION: z.string().default("unknown"),
  POLICY_VERSION: z.string().default("2026-10-01"),
  DPO_CONTACT: z.string().default("dpo@schoolpawa.example"),
  RETENTION_INACTIVE_DAYS: z.coerce.number().int().min(30).default(365),

  SMS_DRIVER: z.enum(["console", "africastalking"]).default("console"),
  AT_USERNAME: z.string().default("sandbox"),
  AT_API_KEY: z.string().default(""),
  AT_SENDER_ID: z.string().default(""),

  SCHOOL_POWER_C: z.coerce.number().positive().default(20),
  TOPIC_LIVE_MIN: z.coerce.number().int().min(1).default(60),
  MAX_PROFILES_PER_DEVICE: z.coerce.number().int().min(1).max(10).default(4),
  FLAG_THRESHOLD: z.coerce.number().int().min(1).default(3),
  OFFLINE_DAILY_POINT_CAP: z.coerce.number().int().min(0).default(150),
  BLOCKED_TERMS_EXTRA: z.string().default(""),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  if (env.APP_ENV === "production") {
    if (env.SMS_DRIVER === "console") throw new Error("SMS_DRIVER=console is not allowed in production.");
    if (env.TOPIC_LIVE_MIN < 60) throw new Error("TOPIC_LIVE_MIN must be ≥ 60 in production (PRD §4.1).");
  }
  if (env.DATA_RESIDENCY.toLowerCase() !== "tz") {
    // PDPA cross-border transfer: allowed only with adequate protection; must be documented.
    console.warn(
      `[compliance] DATA_RESIDENCY=${env.DATA_RESIDENCY} (DB_REGION=${env.DB_REGION}). ` +
        "Personal data is stored outside Tanzania — confirm the adequacy basis in docs/hosting-decision.md.",
    );
  }

  return {
    ...env,
    isProd: env.APP_ENV === "production",
    /** Secure cookies everywhere except local http dev. */
    secureCookies: env.APP_URL.startsWith("https://"),
    blockedTermsExtra: env.BLOCKED_TERMS_EXTRA.split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export const config = load();
export type Config = typeof config;
