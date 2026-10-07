import { z } from "zod";
import { confirmConsent, profileSchema } from "@/server/consent";
import { body, route } from "@/server/http";
import { ensureDevice, startStudentSession } from "@/server/session";

/**
 * The child's profile reaches the server ONLY here, after the parent has entered the SMS code
 * on the consent screen. The OTP check, guardian, student, consent record and device link are
 * created in one transaction (see server/consent.ts).
 */
export const POST = route(async (req) => {
  const input = await body(
    req,
    z.object({ requestId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), locale: z.enum(["sw", "en"]), profile: profileSchema }),
  );
  const deviceId = await ensureDevice();
  const student = await confirmConsent({ ...input, deviceId });
  await startStudentSession(student.id, deviceId);
  return { studentId: student.id, nickname: student.nickname, discriminator: student.discriminator };
});
