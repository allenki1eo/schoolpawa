import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { difficultyMix, orderForPlayer, recentAccuracy, selectQuestions } from "./selection";
import type { Candidate, Difficulty, SeenInfo } from "./types";

const SEED = "5e".repeat(32);

function pool(n: number, subTopics = ["a", "b", "c"]): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `q:${i}`,
    difficulty: ((i % 3) + 1) as Difficulty,
    // Sub-topic varies independently of difficulty.
    subTopic: subTopics[Math.floor(i / 3) % subTopics.length]!,
  }));
}

describe("difficultyMix", () => {
  it("sums to 1 and shifts toward hard as accuracy rises", () => {
    for (const a of [0, 0.3, 0.6, 1]) {
      const [e, m, h] = difficultyMix(a);
      expect(e + m + h).toBeCloseTo(1, 10);
      expect(e).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
    expect(difficultyMix(0)[0]).toBeGreaterThan(difficultyMix(1)[0]);
    expect(difficultyMix(1)[2]).toBeGreaterThan(difficultyMix(0)[2]);
  });

  it("uses a sensible default and clamps garbage", () => {
    expect(difficultyMix(null)).toEqual(difficultyMix(0.6));
    expect(difficultyMix(5)).toEqual(difficultyMix(1));
    expect(difficultyMix(Number.NaN)).toEqual(difficultyMix(0.6));
  });
});

describe("selectQuestions", () => {
  it("returns the requested count with no duplicates", () => {
    const out = selectQuestions({ candidates: pool(60), seen: new Map(), accuracy: null, count: 10, rng: createRng(SEED) });
    expect(out).toHaveLength(10);
    expect(new Set(out.map((c) => c.key)).size).toBe(10);
  });

  it("is reproducible from the seed", () => {
    const args = { candidates: pool(60), seen: new Map(), accuracy: 0.5, count: 10 };
    const a = selectQuestions({ ...args, rng: createRng(SEED) }).map((c) => c.key);
    const b = selectQuestions({ ...args, rng: createRng(SEED) }).map((c) => c.key);
    expect(a).toEqual(b);
  });

  it("never picks a seen question while unseen ones remain", () => {
    const candidates = pool(60);
    const seen = new Map<string, SeenInfo>();
    candidates.slice(0, 45).forEach((c, i) => seen.set(c.key, { lastSeenAt: i, timesSeen: 1 }));
    for (let s = 0; s < 20; s++) {
      const out = selectQuestions({ candidates, seen, accuracy: null, count: 10, rng: createRng(SEED).fork(String(s)) });
      expect(out.every((c) => !seen.has(c.key))).toBe(true);
    }
  });

  it("tops up with the oldest-seen questions when unseen run out", () => {
    const candidates = pool(30);
    const seen = new Map<string, SeenInfo>();
    // 26 seen; q:0 is the oldest, q:25 the newest. 4 unseen remain.
    candidates.slice(0, 26).forEach((c, i) => seen.set(c.key, { lastSeenAt: 1000 + i, timesSeen: 1 }));
    const out = selectQuestions({ candidates, seen, accuracy: null, count: 10, rng: createRng(SEED) });
    const keys = out.map((c) => c.key);
    // All 4 unseen are used.
    for (const k of ["q:26", "q:27", "q:28", "q:29"]) expect(keys).toContain(k);
    // The 6 recycled ones come from the oldest window, never from the newest seen items.
    const recycled = out.filter((c) => seen.has(c.key)).map((c) => seen.get(c.key)!.lastSeenAt);
    expect(recycled).toHaveLength(6);
    expect(Math.max(...recycled)).toBeLessThan(1000 + 26 - 6); // newest 6 untouched
  });

  it("balances sub-topics within a round", () => {
    const candidates = pool(90, ["fractions", "decimals", "percent"]);
    const out = selectQuestions({ candidates, seen: new Map(), accuracy: 0.6, count: 9, rng: createRng(SEED) });
    const bySub = new Map<string, number>();
    out.forEach((c) => bySub.set(c.subTopic, (bySub.get(c.subTopic) ?? 0) + 1));
    expect([...bySub.values()].every((n) => n === 3)).toBe(true);
  });

  it("adapts the difficulty mix to accuracy (statistically)", () => {
    const candidates = pool(300);
    const hardShare = (accuracy: number) => {
      let hard = 0;
      let total = 0;
      for (let s = 0; s < 200; s++) {
        const out = selectQuestions({ candidates, seen: new Map(), accuracy, count: 10, rng: createRng(SEED).fork(`${accuracy}-${s}`) });
        hard += out.filter((c) => c.difficulty === 3).length;
        total += out.length;
      }
      return hard / total;
    };
    const weak = hardShare(0.1);
    const strong = hardShare(0.95);
    expect(weak).toBeCloseTo(difficultyMix(0.1)[2], 1);
    expect(strong).toBeCloseTo(difficultyMix(0.95)[2], 1);
    expect(strong).toBeGreaterThan(weak + 0.2);
  });

  it("falls back to the nearest difficulty when a level is empty", () => {
    const candidates = pool(30).filter((c) => c.difficulty !== 3);
    const out = selectQuestions({ candidates, seen: new Map(), accuracy: 1, count: 10, rng: createRng(SEED) });
    expect(out).toHaveLength(10);
    expect(out.every((c) => c.difficulty !== 3)).toBe(true);
  });

  it("repeats only templates when the distinct pool is too small", () => {
    const candidates: Candidate[] = [
      { key: "q:1", difficulty: 1, subTopic: "a" },
      { key: "t:1", difficulty: 2, subTopic: "a" },
      { key: "t:2", difficulty: 3, subTopic: "b" },
    ];
    const out = selectQuestions({ candidates, seen: new Map(), accuracy: null, count: 10, rng: createRng(SEED) });
    expect(out).toHaveLength(10);
    expect(out.filter((c) => c.key === "q:1")).toHaveLength(1);
  });

  it("returns fewer when only static questions exist and the pool is small", () => {
    const out = selectQuestions({ candidates: pool(4), seen: new Map(), accuracy: null, count: 10, rng: createRng(SEED) });
    expect(out).toHaveLength(4);
  });

  it("handles empty input", () => {
    expect(selectQuestions({ candidates: [], seen: new Map(), accuracy: null, count: 10, rng: createRng(SEED) })).toEqual([]);
  });
});

describe("head-to-head ordering", () => {
  it("gives both players the same set in different orders", () => {
    const base = createRng(SEED);
    const set = selectQuestions({ candidates: pool(60), seen: new Map(), accuracy: null, count: 10, rng: base.fork("select") });
    const p1 = orderForPlayer(set, base.fork("player:challenger"));
    const p2 = orderForPlayer(set, base.fork("player:opponent"));
    expect(new Set(p1.map((c) => c.key))).toEqual(new Set(p2.map((c) => c.key)));
    expect(p1.map((c) => c.key)).not.toEqual(p2.map((c) => c.key));
  });
});

describe("recentAccuracy", () => {
  it("returns null with too little history", () => {
    expect(recentAccuracy([true, false])).toBeNull();
  });
  it("uses only the most recent window", () => {
    const results = [...Array(30).fill(true), ...Array(30).fill(false)];
    expect(recentAccuracy(results)).toBe(1);
    expect(recentAccuracy([true, false, true, false, true, false])).toBe(0.5);
  });
});
