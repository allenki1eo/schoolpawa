import { z } from "zod";
import { body, route } from "@/server/http";
import { block, unblock } from "@/server/safety";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { studentId, undo } = await body(req, z.object({ studentId: z.string().uuid(), undo: z.boolean().optional() }));
  const me = await requireStudent();
  if (undo) await unblock(me, studentId);
  else await block(me, studentId);
  return { ok: true };
});
