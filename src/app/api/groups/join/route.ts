import { z } from "zod";
import { joinGroup } from "@/server/groups";
import { body, route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route(async (req) => {
  const { code } = await body(req, z.object({ code: z.string().max(12) }));
  const group = await joinGroup(await requireStudent(), code);
  return { id: group.id };
});
