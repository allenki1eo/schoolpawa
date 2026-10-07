import { cookies } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { body, route } from "@/server/http";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { currentStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { locale } = await body(req, z.object({ locale: z.enum(["sw", "en"]) }));
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 400, sameSite: "lax" });
  const student = await currentStudent();
  if (student) await db.update(schema.students).set({ locale }).where(eq(schema.students.id, student.id));
  return { ok: true };
});
