import { z } from "zod";
import { body, route } from "@/server/http";
import { startSession } from "@/server/quiz/engine";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { topicId, kind } = await body(req, z.object({ topicId: z.string().uuid(), kind: z.enum(["practice", "daily"]) }));
  const student = await requireStudent();
  return startSession({ student, topicId, kind });
});
