import { z } from "zod";
import { react } from "@/server/groups";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const input = await body(req, z.object({ presetKey: z.string().max(30), toStudentId: z.string().uuid().optional() }));
  await react(await requireStudent(), id, input.presetKey, input.toStudentId);
  return { ok: true };
});
