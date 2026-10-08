/**
 * Quests: fixed, deterministic goals with fixed XP rewards. No randomness and nothing to buy
 * (PRD §7.3: no loot boxes). Progress is derived from records the server already keeps, so
 * there is no separate counter to cheat or drift.
 */

export type QuestPeriod = "daily" | "weekly";

export interface QuestStats {
  roundsToday: number;
  bestRunToday: number; // longest run of consecutive correct answers in a single round today
  dailyDoneToday: boolean;
  challengesToday: number; // 1v1 rounds played today (sent or accepted)
  perfectToday: boolean;
  roundsThisWeek: number;
  cheersThisWeek: number;
  topicsThisWeek: number; // distinct topics played this week
}

export interface QuestDef {
  key: string;
  period: QuestPeriod;
  target: number;
  reward: number;
  icon: "play" | "flame" | "calendar" | "swords" | "star" | "trophy" | "heart" | "compass";
  progress: (s: QuestStats) => number;
}

export const QUESTS: readonly QuestDef[] = [
  { key: "play_2", period: "daily", target: 2, reward: 20, icon: "play", progress: (s) => s.roundsToday },
  { key: "combo_5", period: "daily", target: 5, reward: 15, icon: "flame", progress: (s) => s.bestRunToday },
  { key: "daily_done", period: "daily", target: 1, reward: 15, icon: "calendar", progress: (s) => (s.dailyDoneToday ? 1 : 0) },
  { key: "duel_1", period: "daily", target: 1, reward: 20, icon: "swords", progress: (s) => s.challengesToday },
  { key: "rounds_15", period: "weekly", target: 15, reward: 100, icon: "trophy", progress: (s) => s.roundsThisWeek },
  { key: "explorer_3", period: "weekly", target: 3, reward: 40, icon: "compass", progress: (s) => s.topicsThisWeek },
  { key: "cheer_3", period: "weekly", target: 3, reward: 15, icon: "heart", progress: (s) => s.cheersThisWeek },
] as const;

export interface QuestState {
  key: string;
  period: QuestPeriod;
  icon: QuestDef["icon"];
  target: number;
  reward: number;
  progress: number; // clamped to target
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
}

export function questStates(stats: QuestStats, claimedKeys: ReadonlySet<string>): QuestState[] {
  return QUESTS.map((q) => {
    const progress = Math.min(q.target, Math.max(0, q.progress(stats)));
    const complete = progress >= q.target;
    const claimed = claimedKeys.has(q.key);
    return { key: q.key, period: q.period, icon: q.icon, target: q.target, reward: q.reward, progress, complete, claimed, claimable: complete && !claimed };
  });
}

export function questByKey(key: string): QuestDef | undefined {
  return QUESTS.find((q) => q.key === key);
}

/** Longest run of `true` values (consecutive correct answers in one round). */
export function longestRun(results: readonly boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}
