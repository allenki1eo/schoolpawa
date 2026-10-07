import { describe, expect, it } from "vitest";
import { decideChallenge, expectedScore, INITIAL_RATING, kFactor, updateElo } from "./elo";
import { mostImprovedSchools, mostImprovedStudents } from "./improvement";
import { leveledUp, levelFor, nextStreak } from "./levels";
import {
  assignRanks,
  participationBonus,
  populationMean,
  rankSchools,
  schoolPower,
  sizeBandFor,
  type SchoolPeriodStats,
} from "./school-power";
import { scoreAnswer, TIME_LIMIT_MS } from "../quiz/scoring";

const school = (schoolId: string, points: number, activeStudents: number, enrolledEstimate = 500): SchoolPeriodStats => ({
  schoolId,
  points,
  activeStudents,
  enrolledEstimate,
});

describe("School Power", () => {
  it("matches the PRD formula exactly", () => {
    // m = 50, C = 20, 40 active students with 2,400 points, 400 enrolled.
    const r = schoolPower(school("x", 2400, 40, 400), 50, 20);
    const bayes = (20 * 50 + 2400) / (20 + 40);
    expect(r.bayes).toBeCloseTo(bayes, 10);
    expect(r.participationBonus).toBeCloseTo(0.01, 10); // 40/400 × 0.10
    expect(r.power).toBeCloseTo(bayes * 1.01, 10);
  });

  // A national population of 200 ordinary schools: 30 active students averaging 80 points.
  const nation = Array.from({ length: 200 }, (_, i) => school(`n${i}`, 30 * 80, 30, 400));

  it("a 2-player school with a lucky week cannot beat a strong 300-player school", () => {
    const tiny = school("tiny", 2 * 240, 2, 150); // 3× the national average, by luck
    const big = school("big", 300 * 110, 300, 900); // consistently above average
    const ranked = rankSchools([tiny, big], [...nation, tiny, big]);
    expect(ranked[0]!.schoolId).toBe("big");
    // The 2-player school is pulled almost all the way back to the mean.
    const m = populationMean([...nation, tiny, big]);
    expect(ranked[1]!.bayes).toBeLessThan(m * 1.2);
  });

  it("but a small school that is consistently better does rise to the top", () => {
    const small = school("small", 40 * 160, 40, 120); // avg 160, high participation
    const big = school("big", 300 * 110, 300, 900);
    const ranked = rankSchools([small, big], [...nation, small, big]);
    expect(ranked[0]!.schoolId).toBe("small");
  });

  it("converges to the school's own average as active students grow", () => {
    const m = 50;
    const own = 120;
    const at = (n: number) => schoolPower(school("s", own * n, n, 1e9), m).bayes;
    expect(at(1)).toBeLessThan(at(20));
    expect(at(20)).toBeLessThan(at(1000));
    expect(at(100_000)).toBeCloseTo(own, 0);
  });

  it("caps the participation bonus at +10 %", () => {
    expect(participationBonus(50, 100)).toBeCloseTo(0.05);
    expect(participationBonus(150, 100)).toBe(0.1);
    expect(participationBonus(10, 0)).toBe(0);
  });

  it("hides schools with no active students and computes m from the population", () => {
    const pop = [school("a", 1000, 10), school("b", 500, 10), school("c", 0, 0)];
    expect(populationMean(pop)).toBe(75);
    expect(populationMean([])).toBe(0);
    const ranked = rankSchools(pop.slice(0, 1), pop);
    expect(ranked.map((r) => r.schoolId)).toEqual(["a"]);
    expect(rankSchools(pop).map((r) => r.schoolId)).toEqual(["a", "b"]);
    expect(schoolPower(school("z", 0, 0), 75).power).toBe(0);
  });

  it("gives ties the same rank", () => {
    const ranked = assignRanks([{ s: 10 }, { s: 8 }, { s: 8 }, { s: 3 }], (x) => x.s);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("assigns size bands", () => {
    expect(sizeBandFor(120)).toBe("S");
    expect(sizeBandFor(300)).toBe("M");
    expect(sizeBandFor(1499)).toBe("L");
    expect(sizeBandFor(4000)).toBe("XL");
  });
});

describe("Elo", () => {
  it("expected scores are symmetric", () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1200, 1000) + expectedScore(1000, 1200)).toBeCloseTo(1, 12);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
  });

  it("winner gains, loser loses, and upsets move ratings more", () => {
    const even = updateElo({ rating: 1000, games: 20 }, { rating: 1000, games: 20 }, 1);
    expect(even.a).toBe(1012);
    expect(even.b).toBe(988);
    const upset = updateElo({ rating: 900, games: 20 }, { rating: 1300, games: 20 }, 1);
    expect(upset.a - 900).toBeGreaterThan(even.a - 1000);
  });

  it("uses a larger K while provisional", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(10)).toBe(24);
    const r = updateElo({ rating: INITIAL_RATING, games: 0 }, { rating: INITIAL_RATING, games: 50 }, 1);
    expect(r.a).toBe(1020);
    expect(r.b).toBe(988);
  });

  it("draws between equals change nothing", () => {
    expect(updateElo({ rating: 1000, games: 5 }, { rating: 1000, games: 5 }, 0.5)).toEqual({ a: 1000, b: 1000 });
  });

  it("decides challenges by score, then time", () => {
    expect(decideChallenge({ score: 90, totalTimeMs: 99_000 }, { score: 80, totalTimeMs: 10_000 })).toBe(1);
    expect(decideChallenge({ score: 80, totalTimeMs: 50_000 }, { score: 80, totalTimeMs: 40_000 })).toBe(0);
    expect(decideChallenge({ score: 80, totalTimeMs: 40_000 }, { score: 80, totalTimeMs: 40_000 })).toBe(0.5);
  });
});

describe("Improvement awards", () => {
  it("requires activity in both weeks", () => {
    const rows = [
      { studentId: "returning", thisWeekXp: 900, lastWeekXp: 0, thisWeekRounds: 10, lastWeekRounds: 0 },
      { studentId: "climber", thisWeekXp: 600, lastWeekXp: 200, thisWeekRounds: 8, lastWeekRounds: 4 },
      { studentId: "steady", thisWeekXp: 500, lastWeekXp: 450, thisWeekRounds: 8, lastWeekRounds: 8 },
      { studentId: "dropped", thisWeekXp: 100, lastWeekXp: 600, thisWeekRounds: 3, lastWeekRounds: 9 },
    ];
    expect(mostImprovedStudents(rows).map((r) => r.studentId)).toEqual(["climber", "steady"]);
  });

  it("uses relative gain with the mean as a floor", () => {
    const rows = [
      { schoolId: "near-zero", powerNow: 5, powerPrev: 0.5, activeNow: 6, activePrev: 6 },
      { schoolId: "solid", powerNow: 90, powerPrev: 60, activeNow: 50, activePrev: 45 },
      { schoolId: "tiny", powerNow: 200, powerPrev: 10, activeNow: 2, activePrev: 2 },
    ];
    const out = mostImprovedSchools(rows, 50);
    expect(out[0]!.schoolId).toBe("solid"); // +50 %
    expect(out[1]!.schoolId).toBe("near-zero"); // 4.5 / 50 = +9 %, not +900 %
    expect(out.find((r) => r.schoolId === "tiny")).toBeUndefined();
  });
});

describe("Levels and streaks", () => {
  it("maps XP to levels with progress", () => {
    expect(levelFor(0).key).toBe("mwanafunzi");
    expect(levelFor(499).key).toBe("mwanafunzi");
    expect(levelFor(500).key).toBe("shujaa");
    expect(levelFor(1250).progress).toBeCloseTo(0.5);
    expect(levelFor(1250).xpToNext).toBe(750);
    expect(levelFor(99_999)).toMatchObject({ key: "gwiji", next: null, progress: 1 });
    expect(leveledUp(480, 520)).toBe(true);
    expect(leveledUp(520, 600)).toBe(false);
  });

  it("updates streaks by calendar day", () => {
    expect(nextStreak(0, null, "2026-10-07")).toBe(1);
    expect(nextStreak(4, "2026-10-07", "2026-10-07")).toBe(4);
    expect(nextStreak(4, "2026-10-06", "2026-10-07")).toBe(5);
    expect(nextStreak(4, "2026-10-04", "2026-10-07")).toBe(1);
    expect(nextStreak(9, "2026-12-31", "2027-01-01")).toBe(10);
  });
});

describe("Answer scoring", () => {
  const limit = TIME_LIMIT_MS.mcq;
  it("rewards correctness, difficulty and speed", () => {
    expect(scoreAnswer({ correct: false, difficulty: 3, timeMs: 1000, limitMs: limit, kind: "practice" })).toBe(0);
    expect(scoreAnswer({ correct: true, difficulty: 1, timeMs: limit, limitMs: limit, kind: "practice" })).toBe(10);
    expect(scoreAnswer({ correct: true, difficulty: 1, timeMs: 0, limitMs: limit, kind: "practice" })).toBe(15);
    expect(scoreAnswer({ correct: true, difficulty: 3, timeMs: limit / 2, limitMs: limit, kind: "practice" })).toBe(19);
  });

  it("applies round multipliers and the timeout rule", () => {
    expect(scoreAnswer({ correct: true, difficulty: 1, timeMs: limit, limitMs: limit, kind: "daily" })).toBe(15);
    expect(scoreAnswer({ correct: true, difficulty: 1, timeMs: limit, limitMs: limit, kind: "offline" })).toBe(5);
    expect(scoreAnswer({ correct: true, difficulty: 1, timeMs: limit + 3001, limitMs: limit, kind: "practice" })).toBe(0);
  });
});
