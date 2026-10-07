import { z } from "zod";
import { requestConsent } from "@/server/consent";
import { body, route } from "@/server/http";
import { ensureDevice } from "@/server/session";

export const POST = route(async (req) => {
  const input = await body(req, z.object({ phone: z.string().min(6).max(20), locale: z.enum(["sw", "en"]) }));
  const deviceId = await ensureDevice();
  return requestConsent({ ...input, deviceId });
});
