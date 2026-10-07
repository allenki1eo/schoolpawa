import { z } from "zod";
import { createGroup, myGroups } from "@/server/groups";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const GET = route(async () => ({ groups: await myGroups(await requireStudent()) }));

export const POST = route(async (req) => {
  const input = await body(req, z.object({ name: z.string().max(40), emblem: z.string().max(20) }));
  const group = await createGroup(await requireStudent(), input);
  return { id: group.id, inviteCode: group.inviteCode };
});
