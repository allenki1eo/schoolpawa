import { z } from "zod";
import { body, route } from "@/server/http";
import { report } from "@/server/safety";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const input = await body(req, z.object({ targetType: z.enum(["student", "group", "question"]), targetId: z.string().uuid(), reason: z.string().max(30) }));
  return report(await requireStudent(), input.targetType, input.targetId, input.reason);
});
