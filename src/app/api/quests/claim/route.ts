import { z } from "zod";
import { body, route } from "@/server/http";
import { claimQuest } from "@/server/quests";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { key } = await body(req, z.object({ key: z.string().max(30) }));
  return claimQuest(await requireStudent(), key);
});
