import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { audit } from "../audit";
import { config } from "../config";
import { verifySecret } from "../crypto";
import { rateLimit } from "../rate-limit";

const COOKIE = "sp_admin";
const MAX_AGE = 60 * 60 * 8;
const key = new TextEncoder().encode(`${config.SESSION_SECRET}:admin`);

export type Admin = typeof schema.admins.$inferSelect;
export type AdminRole = Admin["role"];

export async function adminLogin(email: string, password: string, ipKey: string): Promise<boolean> {
  await rateLimit("adminLogin", ipKey);
  const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.email, email.toLowerCase().trim()));
  if (!admin || !admin.active || !(await verifySecret(password, admin.passwordHash))) return false;
  const token = await new SignJWT({ aid: admin.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(key);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: config.isProd, path: "/admin", maxAge: MAX_AGE });
  await audit({ actorType: "admin", actorId: admin.id, action: "admin.login" });
  return true;
}

export async function adminLogout() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function currentAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.id, String(payload.aid)));
    return admin?.active ? admin : null;
  } catch {
    return null;
  }
}

const RANK: Record<AdminRole, number> = { reviewer: 1, moderator: 2, superadmin: 3 };

/** For pages and server actions. Redirects to login when signed out. */
export async function requireAdmin(min: AdminRole = "reviewer"): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  if (RANK[admin.role] < RANK[min]) throw new Error("Forbidden");
  return admin;
}

export function canModerate(admin: Admin) {
  return RANK[admin.role] >= RANK.moderator;
}
