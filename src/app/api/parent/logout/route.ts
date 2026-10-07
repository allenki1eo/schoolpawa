import { route } from "@/server/http";
import { endParentSession } from "@/server/parent-session";

export const POST = route(async () => {
  await endParentSession();
  return { ok: true };
});
