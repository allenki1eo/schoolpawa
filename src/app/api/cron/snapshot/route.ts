import { assertCron } from "@/server/cron";
import { route } from "@/server/http";
import { snapshotWeek } from "@/server/snapshots";

/** Monday 00:05 EAT: freeze last week's School Power leagues into ranking_snapshots. */
export const POST = route(async (req) => {
  assertCron(req);
  return snapshotWeek();
});
