import { z } from "zod";
import { respondBattle } from "@/server/battles";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { accept } = await body(req, z.object({ accept: z.boolean() }));
  await respondBattle(await requireStudent(), id, accept);
  return { ok: true };
});
