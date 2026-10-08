/**
 * Group vs Group battle scoring: average counted points per MEMBER (members fixed when the battle
 * starts) in the battle topic during the window. Inactive members count as zero, so the group
 * that turns up together wins — one hyper-active player can't carry a group. Groups need at
 * least MIN_BATTLE_MEMBERS so a one-person "group" can't farm wins.
 */
export const MIN_BATTLE_MEMBERS = 3;
export const BATTLE_DURATION_MS = 3 * 86_400_000;
export const BATTLE_ACCEPT_WINDOW_MS = 2 * 86_400_000;

export interface BattleSide {
  points: number;
  members: number;
}

export function battleScore(side: BattleSide): number {
  return side.members <= 0 ? 0 : side.points / side.members;
}

export function decideBattle(a: BattleSide, b: BattleSide): { a: number; b: number; winner: "a" | "b" | "draw" } {
  const sa = battleScore(a);
  const sb = battleScore(b);
  const winner = Math.abs(sa - sb) < 1e-9 ? "draw" : sa > sb ? "a" : "b";
  return { a: sa, b: sb, winner };
}
