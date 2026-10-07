import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { isDeviceBurst } from "@/lib/integrity/anomaly";
import { checkName, NICKNAME_RULES } from "@/lib/safety/profanity";
import { AVATARS } from "@/lib/safety/presets";
import { maskPhone, normalizeTzPhone } from "@/lib/safety/codes";
import { audit } from "./audit";
import { config } from "./config";
import { hashPhone, hashSecret, newOtp, secureRandomInt, verifySecret } from "./crypto";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
import { sendSms } from "./sms";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const SMS_TEXT = {
  consent: {
    sw: (code: string) =>
      `School Pawa: Mtoto anaomba ruhusa yako kutumia School Pawa (michezo ya maswali ya shule). Namba ya ruhusa: ${code}. Itumie tu kama unakubali. Haitumiki baada ya dakika 10.`,
    en: (code: string) =>
      `School Pawa: A child is asking your permission to use School Pawa (school quiz games). Consent code: ${code}. Use it only if you agree. Expires in 10 minutes.`,
  },
  parent_login: {
    sw: (code: string) => `School Pawa: Namba yako ya kuingia ukurasa wa mzazi ni ${code}. Usimpe mtu yeyote.`,
    en: (code: string) => `School Pawa: Your parent page login code is ${code}. Do not share it.`,
  },
} as const;

type Purpose = keyof typeof SMS_TEXT;
type Locale = "sw" | "en";

async function issueOtp(purpose: Purpose, e164: string, locale: Locale, send: boolean) {
  const phoneHash = hashPhone(e164);
  await rateLimit("otpPerPhone", phoneHash);
  const code = newOtp();
  const [row] = await db
    .insert(schema.otpRequests)
    .values({ purpose, phoneHash, codeHash: await hashSecret(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) })
    .returning({ id: schema.otpRequests.id });
  if (send) await sendSms(e164, SMS_TEXT[purpose][locale](code));
  return { requestId: row!.id, phoneHash };
}

/** Verify and consume an OTP. Increments attempts on failure; burns the request after 5 misses. */
async function consumeOtp(requestId: string, purpose: Purpose, code: string) {
  await rateLimit("otpVerify", requestId);
  const [row] = await db.select().from(schema.otpRequests).where(eq(schema.otpRequests.id, requestId));
  if (!row || row.purpose !== purpose || row.consumedAt) throw new ApiError(400, "otp_invalid");
  if (row.expiresAt.getTime() < Date.now()) throw new ApiError(400, "otp_expired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(400, "otp_locked");
  if (!(await verifySecret(code, row.codeHash))) {
    await db
      .update(schema.otpRequests)
      .set({ attempts: sql`${schema.otpRequests.attempts} + 1` })
      .where(eq(schema.otpRequests.id, requestId));
    throw new ApiError(400, "otp_wrong", { attemptsLeft: OTP_MAX_ATTEMPTS - row.attempts - 1 });
  }
  const consumed = await db
    .update(schema.otpRequests)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.otpRequests.id, requestId), sql`${schema.otpRequests.consumedAt} is null`))
    .returning({ phoneHash: schema.otpRequests.phoneHash });
  if (consumed.length === 0) throw new ApiError(400, "otp_invalid"); // raced with another request
  return consumed[0]!.phoneHash;
}

// ─── Consent (child onboarding) ─────────────────────────────────────────────────────────────

export async function requestConsent(input: { phone: string; locale: Locale; deviceId: string }) {
  const e164 = normalizeTzPhone(input.phone);
  if (!e164) throw new ApiError(400, "phone_invalid");
  await rateLimit("otpPerDevice", input.deviceId);
  const { requestId } = await issueOtp("consent", e164, input.locale, true);
  return { requestId, maskedPhone: maskPhone(e164) };
}

export const profileSchema = z.object({
  nickname: z.string().min(1).max(40),
  avatar: z.enum(AVATARS),
  schoolId: z.string().uuid(),
  gradeLevelId: z.string().min(1).max(20),
  pin: z.string().regex(/^\d{4}$/),
});

export async function confirmConsent(input: {
  requestId: string;
  code: string;
  locale: Locale;
  deviceId: string;
  profile: z.infer<typeof profileSchema>;
}) {
  const { profile, deviceId } = input;

  // Validate everything about the profile BEFORE consuming the OTP, so a typo in the nickname
  // doesn't force the parent to request a new SMS.
  const name = checkName(profile.nickname, { ...NICKNAME_RULES, extraBlocked: config.blockedTermsExtra });
  if (!name.ok) throw new ApiError(400, "nickname_rejected", { problem: name.problem });

  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, profile.schoolId));
  const [grade] = await db.select().from(schema.gradeLevels).where(eq(schema.gradeLevels.id, profile.gradeLevelId));
  if (!school || !school.active) throw new ApiError(400, "school_invalid");
  if (!grade || !grade.active || grade.stage !== school.stage) throw new ApiError(400, "grade_invalid");

  const deviceProfiles = await db
    .select({ createdAt: schema.deviceProfiles.createdAt })
    .from(schema.deviceProfiles)
    .where(eq(schema.deviceProfiles.deviceId, deviceId));
  if (deviceProfiles.length >= config.MAX_PROFILES_PER_DEVICE) throw new ApiError(400, "device_profile_limit");

  const phoneHash = await consumeOtp(input.requestId, "consent", input.code);
  const pinHash = await hashSecret(profile.pin);

  const student = await db.transaction(async (tx) => {
    const [guardian] = await tx
      .insert(schema.guardians)
      .values({ phoneHash })
      .onConflictDoUpdate({ target: schema.guardians.phoneHash, set: { phoneHash } })
      .returning({ id: schema.guardians.id });

    // Random discriminator; retry on the (rare) handle collision.
    let created: typeof schema.students.$inferSelect | undefined;
    for (let attempt = 0; attempt < 8 && !created; attempt++) {
      const discriminator = secureRandomInt(10_000);
      const taken = await tx
        .select({ n: count() })
        .from(schema.students)
        .where(and(sql`lower(${schema.students.nickname}) = lower(${name.value})`, eq(schema.students.discriminator, discriminator)));
      if (taken[0]!.n > 0) continue;
      [created] = await tx
        .insert(schema.students)
        .values({
          nickname: name.value,
          discriminator,
          avatar: profile.avatar,
          gradeLevelId: grade.id,
          schoolId: school.id,
          guardianId: guardian!.id,
          pinHash,
          locale: input.locale,
        })
        .returning();
    }
    if (!created) throw new ApiError(409, "nickname_taken");

    await tx.insert(schema.consents).values({
      guardianId: guardian!.id,
      studentId: created.id,
      phoneHash,
      policyVersion: config.POLICY_VERSION,
      locale: input.locale,
    });
    await tx.insert(schema.deviceProfiles).values({ deviceId, studentId: created.id });
    await audit(
      {
        actorType: "guardian",
        actorId: guardian!.id,
        action: "consent.granted",
        targetType: "student",
        targetId: created.id,
        meta: { policyVersion: config.POLICY_VERSION, method: "sms_otp" },
      },
      tx,
    );
    return created;
  });

  // Integrity: many new profiles on one device in a day.
  const recent = await db
    .select({ createdAt: schema.deviceProfiles.createdAt })
    .from(schema.deviceProfiles)
    .where(and(eq(schema.deviceProfiles.deviceId, deviceId), gte(schema.deviceProfiles.createdAt, new Date(Date.now() - 86_400_000))));
  if (isDeviceBurst(recent.map((r) => r.createdAt), new Date())) {
    await db.insert(schema.anomalyFlags).values({
      kind: "device_profile_burst",
      entityType: "device",
      entityId: deviceId,
      detail: { profilesLast24h: recent.length },
    });
  }

  return student;
}

// ─── Parent portal login ────────────────────────────────────────────────────────────────────

/**
 * Always returns a request id, but only sends an SMS if the number belongs to a guardian, so
 * the endpoint cannot be used to discover which numbers have children registered.
 */
export async function requestParentLogin(input: { phone: string; locale: Locale; deviceId: string }) {
  const e164 = normalizeTzPhone(input.phone);
  if (!e164) throw new ApiError(400, "phone_invalid");
  await rateLimit("otpPerDevice", input.deviceId);
  const [guardian] = await db
    .select({ id: schema.guardians.id })
    .from(schema.guardians)
    .where(eq(schema.guardians.phoneHash, hashPhone(e164)));
  const { requestId } = await issueOtp("parent_login", e164, input.locale, Boolean(guardian));
  return { requestId, maskedPhone: maskPhone(e164) };
}

export async function verifyParentLogin(requestId: string, code: string): Promise<string> {
  const phoneHash = await consumeOtp(requestId, "parent_login", code);
  const [guardian] = await db.select().from(schema.guardians).where(eq(schema.guardians.phoneHash, phoneHash));
  if (!guardian) throw new ApiError(400, "otp_invalid");
  await audit({ actorType: "guardian", actorId: guardian.id, action: "parent.login" });
  return guardian.id;
}
