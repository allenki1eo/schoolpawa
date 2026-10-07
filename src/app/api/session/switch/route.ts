import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { verifySecret } from "@/server/crypto";
import { ApiError, body, route } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { currentDeviceId, startStudentSession } from "@/server/session";

export const POST = route(async (req) => {
  const { studentId, pin } = await body(req, z.object({ studentId: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) }));
  const deviceId = await currentDeviceId();
  if (!deviceId) throw new ApiError(401, "not_signed_in");
  await rateLimit("pinAttempt", `${deviceId}:${studentId}`);
  const [row] = await db
    .select({ student: schema.students })
    .from(schema.deviceProfiles)
    .innerJoin(schema.students, eq(schema.students.id, schema.deviceProfiles.studentId))
    .where(and(eq(schema.deviceProfiles.deviceId, deviceId), eq(schema.deviceProfiles.studentId, studentId)));
  if (!row || row.student.status !== "active") throw new ApiError(404, "student_not_found");
  if (!(await verifySecret(pin, row.student.pinHash))) throw new ApiError(401, "pin_wrong");
  await db.update(schema.students).set({ lastSeenAt: new Date() }).where(eq(schema.students.id, studentId));
  await startStudentSession(studentId, deviceId);
  return { ok: true };
});
