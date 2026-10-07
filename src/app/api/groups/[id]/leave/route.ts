import { leaveGroup } from "@/server/groups";
import { route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  await leaveGroup(await requireStudent(), id);
  return { ok: true };
});
