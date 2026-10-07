import { z } from "zod";
import { createChallenge, myChallenges } from "@/server/challenges";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const GET = route(async () => ({ challenges: await myChallenges(await requireStudent()) }));

export const POST = route(async (req) => {
  const input = await body(
    req,
    z.object({
      topicId: z.string().uuid(),
      opponentHandle: z.string().max(40).optional(),
      opponentId: z.string().uuid().optional(),
      groupId: z.string().uuid().optional(),
      presetMessage: z.string().max(40).optional(),
    }),
  );
  return createChallenge(await requireStudent(), input);
});
