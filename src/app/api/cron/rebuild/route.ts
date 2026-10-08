import { assertCron } from "@/server/cron";
import { route } from "@/server/http";
import { settleBattles } from "@/server/battles";
import { rebuildStudentBoards } from "@/server/leaderboard";

/** Nightly safety net: rebuild the Redis leaderboard cache from the ledger and settle finished group battles. */
export const POST = route(async (req) => {
  assertCron(req);
  return { boards: await rebuildStudentBoards(), battles: await settleBattles() };
});
