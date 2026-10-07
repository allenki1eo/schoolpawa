import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { config } from "./config";
import { ApiError } from "./http";

const COOKIE = "sp_parent";
const MAX_AGE = 30 * 60; // short-lived: parent pages expose a child's data
const key = new TextEncoder().encode(`${config.SESSION_SECRET}:parent`);

export async function startParentSession(guardianId: string) {
  const token = await new SignJWT({ gid: guardianId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: config.secureCookies, path: "/", maxAge: MAX_AGE });
}

export async function currentGuardianId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return String(payload.gid);
  } catch {
    return null;
  }
}

export async function requireGuardian() {
  const id = await currentGuardianId();
  if (!id) throw new ApiError(401, "not_signed_in");
  return id;
}

export async function endParentSession() {
  (await cookies()).delete(COOKIE);
}
