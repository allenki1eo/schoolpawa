import "server-only";
import { config } from "./config";
import { ApiError } from "./http";

/** Cron endpoints require `Authorization: Bearer $CRON_SECRET`. */
export function assertCron(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${config.CRON_SECRET}`) throw new ApiError(401, "unauthorized");
}
