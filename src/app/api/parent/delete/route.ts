import { z } from "zod";
import { body, route } from "@/server/http";
import { requireGuardian } from "@/server/parent-session";
import { eraseChildByGuardian } from "@/server/privacy";

export const POST = route(async (req) => {
  const { studentId } = await body(req, z.object({ studentId: z.string().uuid() }));
  await eraseChildByGuardian(await requireGuardian(), studentId);
  return { ok: true };
});
