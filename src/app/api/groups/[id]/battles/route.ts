import { z } from "zod";
import { createBattle } from "@/server/battles";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const input = await body(req, z.object({ opponentCode: z.string().max(12), topicId: z.string().uuid() }));
  const battle = await createBattle(await requireStudent(), id, input);
  return { id: battle.id };
});
