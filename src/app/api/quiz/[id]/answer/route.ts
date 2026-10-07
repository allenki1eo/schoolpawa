import { z } from "zod";
import { body, route } from "@/server/http";
import { submitAnswer } from "@/server/quiz/engine";
import { requireStudent } from "@/server/session";

const submitted = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mcq"), displayIndex: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal("true_false"), value: z.boolean() }),
  z.object({ type: z.literal("number"), value: z.number().finite() }),
  z.object({ type: z.literal("ordering"), displayOrder: z.array(z.number().int().min(0).max(9)).max(10) }),
  z.object({ type: z.literal("timeout") }),
]);

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const input = await body(req, z.object({ position: z.number().int().min(0).max(50), answer: submitted }));
  return submitAnswer(await requireStudent(), id, input.position, input.answer);
});
