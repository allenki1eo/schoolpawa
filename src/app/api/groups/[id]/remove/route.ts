import { z } from "zod";
import { removeMember } from "@/server/groups";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { memberId } = await body(req, z.object({ memberId: z.string().uuid() }));
  await removeMember(await requireStudent(), id, memberId);
  return { ok: true };
});
