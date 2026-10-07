import { route } from "@/server/http";
import { endStudentSession } from "@/server/session";

export const POST = route(async () => {
  await endStudentSession();
  return { ok: true };
});
