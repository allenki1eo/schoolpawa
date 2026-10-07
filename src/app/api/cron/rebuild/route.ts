import { assertCron } from "@/server/cron";
import { route } from "@/server/http";
import { rebuildStudentBoards } from "@/server/leaderboard";

/** Nightly safety net: rebuild the Redis leaderboard cache from the ledger. */
export const POST = route(async (req) => {
  assertCron(req);
  return rebuildStudentBoards();
});
