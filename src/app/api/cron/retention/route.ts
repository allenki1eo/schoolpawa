import { config } from "@/server/config";
import { assertCron } from "@/server/cron";
import { route } from "@/server/http";
import { runRetention } from "@/server/privacy";

/** Daily. PDPA retention: erase inactive profiles, spent OTPs and old audit rows. */
export const POST = route(async (req) => {
  assertCron(req);
  return runRetention(config.RETENTION_INACTIVE_DAYS);
});
