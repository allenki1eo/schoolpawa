import { z } from "zod";
import { body, route } from "@/server/http";
import { syncResult } from "@/server/offline";
import { rateLimit } from "@/server/rate-limit";
import { requireStudent } from "@/server/session";

const answer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mcq"), displayIndex: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal("true_false"), value: z.boolean() }),
  z.object({ type: z.literal("number"), value: z.number().finite() }),
  z.object({ type: z.literal("ordering"), displayOrder: z.array(z.number().int().min(0).max(9)).max(10) }),
  z.object({ type: z.literal("timeout") }),
]);

export const POST = route(async (req) => {
  const student = await requireStudent();
  await rateLimit("sync", student.id);
  const input = await body(
    req,
    z.object({
      clientResultId: z.string().min(8).max(64),
      packId: z.string().uuid(),
      answers: z.array(z.object({ index: z.number().int().min(0).max(50), answer })).max(50),
    }),
  );
  return syncResult(student, input);
});
