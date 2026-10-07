import "server-only";
import { and, eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/db/client";
import { config } from "./config";
import { ApiError } from "./http";

const DEVICE_COOKIE = "sp_device";
const SESSION_COOKIE = "sp_session";
const key = new TextEncoder().encode(config.SESSION_SECRET);

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.isProd,
  path: "/",
};

async function sign(payload: Record<string, string>, maxAgeSec: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(key);
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as T;
  } catch {
    return null;
  }
}

// ─── Device ─────────────────────────────────────────────────────────────────────────────────

const DEVICE_MAX_AGE = 60 * 60 * 24 * 400;

export async function currentDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const payload = await verify<{ did: string }>(jar.get(DEVICE_COOKIE)?.value);
  return payload?.did ?? null;
}

/** Device id from the cookie, creating a device row + cookie on first use. */
export async function ensureDevice(): Promise<string> {
  const existing = await currentDeviceId();
  if (existing) {
    const [row] = await db.select({ id: schema.devices.id }).from(schema.devices).where(eq(schema.devices.id, existing));
    if (row) return row.id;
  }
  const [device] = await db.insert(schema.devices).values({}).returning({ id: schema.devices.id });
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, await sign({ did: device!.id }, DEVICE_MAX_AGE), { ...cookieBase, maxAge: DEVICE_MAX_AGE });
  return device!.id;
}

// ─── Student session ────────────────────────────────────────────────────────────────────────

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function startStudentSession(studentId: string, deviceId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sign({ sid: studentId, did: deviceId }, SESSION_MAX_AGE), {
    ...cookieBase,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endStudentSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type CurrentStudent = typeof schema.students.$inferSelect;

/** The signed-in student, or null. Verifies the student is still linked to this device. */
export async function currentStudent(): Promise<CurrentStudent | null> {
  const jar = await cookies();
  const payload = await verify<{ sid: string; did: string }>(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const [row] = await db
    .select({ student: schema.students })
    .from(schema.students)
    .innerJoin(
      schema.deviceProfiles,
      and(eq(schema.deviceProfiles.studentId, schema.students.id), eq(schema.deviceProfiles.deviceId, payload.did)),
    )
    .where(eq(schema.students.id, payload.sid));
  if (!row || row.student.status !== "active") return null;
  return row.student;
}

export async function requireStudent(): Promise<CurrentStudent> {
  const s = await currentStudent();
  if (!s) throw new ApiError(401, "not_signed_in");
  return s;
}
