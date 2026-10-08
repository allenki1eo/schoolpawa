import { inbox, markAllRead } from "@/server/notifications";
import { route } from "@/server/http";
import { requireStudent } from "@/server/session";

export const GET = route(async () => ({ items: await inbox((await requireStudent()).id) }));

export const POST = route(async () => {
  await markAllRead((await requireStudent()).id);
  return { ok: true };
});
