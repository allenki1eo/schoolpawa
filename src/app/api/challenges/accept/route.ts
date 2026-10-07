import { z } from "zod";
import { acceptChallenge } from "@/server/challenges";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { code } = await body(req, z.object({ code: z.string().min(4).max(12) }));
  return acceptChallenge(await requireStudent(), code);
});
