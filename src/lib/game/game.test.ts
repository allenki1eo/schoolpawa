import { describe, expect, it } from "vitest";
import { battleScore, decideBattle } from "./battle";
import { comboTier, starsFor } from "./mastery";
import { longestRun, questStates, type QuestStats } from "./quests";

const base: QuestStats = { roundsToday: 0, bestRunToday: 0, dailyDoneToday: false, challengesToday: 0, perfectToday: false, roundsThisWeek: 0, cheersThisWeek: 0, topicsThisWeek: 0 };

describe("quests", () => {
  it("tracks progress, completion and claimability", () => {
    const states = questStates({ ...base, roundsToday: 3, bestRunToday: 4, roundsThisWeek: 15 }, new Set(["rounds_15"]));
    const by = Object.fromEntries(states.map((s) => [s.key, s]));
    expect(by.play_2).toMatchObject({ progress: 2, complete: true, claimable: true });
    expect(by.combo_5).toMatchObject({ progress: 4, complete: false, claimable: false });
    expect(by.rounds_15).toMatchObject({ complete: true, claimed: true, claimable: false });
  });

  it("has fixed, positive rewards and unique keys", () => {
    const states = questStates(base, new Set());
    expect(new Set(states.map((s) => s.key)).size).toBe(states.length);
    expect(states.every((s) => s.reward > 0 && Number.isInteger(s.reward))).toBe(true);
  });

  it("computes the longest correct run", () => {
    expect(longestRun([])).toBe(0);
    expect(longestRun([true, true, false, true, true, true, false])).toBe(3);
  });
});

describe("mastery & combo", () => {
  it("awards stars by best score", () => {
    expect([null, 4, 5, 7, 9, 10].map((n) => starsFor(n))).toEqual([0, 0, 1, 2, 3, 3]);
  });
  it("tiers combos", () => {
    expect([0, 2, 3, 5, 8].map(comboTier)).toEqual([0, 0, 1, 2, 3]);
  });
});

describe("group battles", () => {
  it("rewards the group that turns up, not one hyper-active member", () => {
    const carried = { points: 400 + 0 * 9, members: 10 }; // 1 of 10 played a lot
    const team = { points: 10 * 90, members: 10 }; // everyone played
    expect(decideBattle(carried, team).winner).toBe("b");
  });
  it("normalises for group size", () => {
    expect(decideBattle({ points: 5 * 150, members: 5 }, { points: 25 * 100, members: 25 }).winner).toBe("a");
  });
  it("handles empty groups and draws", () => {
    expect(battleScore({ points: 10, members: 0 })).toBe(0);
    expect(decideBattle({ points: 0, members: 4 }, { points: 0, members: 6 }).winner).toBe("draw");
  });
});
