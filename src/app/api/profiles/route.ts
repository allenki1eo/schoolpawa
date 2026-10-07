import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { route } from "@/server/http";
import { currentDeviceId, currentStudent } from "@/server/session";

/** Profiles linked to this device, for the "who's playing?" switcher (PIN still required). */
export const GET = route(async () => {
  const deviceId = await currentDeviceId();
  if (!deviceId) return { profiles: [], currentId: null };
  const rows = await db
    .select({ id: schema.students.id, nickname: schema.students.nickname, avatar: schema.students.avatar, gradeLevelId: schema.students.gradeLevelId })
    .from(schema.deviceProfiles)
    .innerJoin(schema.students, eq(schema.students.id, schema.deviceProfiles.studentId))
    .where(eq(schema.deviceProfiles.deviceId, deviceId));
  const current = await currentStudent();
  return { profiles: rows, currentId: current?.id ?? null };
});
