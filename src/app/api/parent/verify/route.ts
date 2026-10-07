import { z } from "zod";
import { verifyParentLogin } from "@/server/consent";
import { body, route } from "@/server/http";
import { startParentSession } from "@/server/parent-session";

export const POST = route(async (req) => {
  const { requestId, code } = await body(req, z.object({ requestId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }));
  await startParentSession(await verifyParentLogin(requestId, code));
  return { ok: true };
});
