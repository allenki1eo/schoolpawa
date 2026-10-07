import { describe, expect, it } from "vitest";
import { createRng, newSeed } from "./rng";

const SEED = "a1".repeat(32);

describe("createRng", () => {
  it("is deterministic for a given seed and label (dispute replay)", () => {
    const a = createRng(SEED);
    const b = createRng(SEED);
    const seqA = Array.from({ length: 50 }, () => a.int(0, 1_000_000));
    const seqB = Array.from({ length: 50 }, () => b.int(0, 1_000_000));
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds and forks", () => {
    const a = Array.from({ length: 20 }, createRng(SEED).float);
    const b = Array.from({ length: 20 }, createRng("b2".repeat(32)).float);
    const fork1 = createRng(SEED).fork("player-1");
    const fork2 = createRng(SEED).fork("player-2");
    expect(a).not.toEqual(b);
    expect(Array.from({ length: 20 }, fork1.float)).not.toEqual(Array.from({ length: 20 }, fork2.float));
  });

  it("forks are independent of how much the parent consumed", () => {
    const p1 = createRng(SEED);
    p1.float();
    p1.float();
    const p2 = createRng(SEED);
    expect(p1.fork("x").int(0, 1e9)).toBe(p2.fork("x").int(0, 1e9));
  });

  it("float stays in [0, 1)", () => {
    const rng = createRng(newSeed());
    for (let i = 0; i < 5000; i++) {
      const x = rng.float();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("int is inclusive and roughly uniform", () => {
    const rng = createRng(SEED);
    const counts = new Array(6).fill(0);
    const N = 60_000;
    for (let i = 0; i < N; i++) counts[rng.int(1, 6) - 1] += 1;
    for (const c of counts) {
      // Expected 10 000 each; 5 % tolerance is > 10 standard deviations.
      expect(Math.abs(c - N / 6)).toBeLessThan(N / 6 * 0.05);
    }
  });

  it("shuffle is a permutation and does not mutate input", () => {
    const rng = createRng(SEED);
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
  });

  it("shuffle visits every permutation of 3 items with similar frequency", () => {
    const rng = createRng(SEED);
    const freq = new Map<string, number>();
    const N = 30_000;
    for (let i = 0; i < N; i++) {
      const k = rng.shuffle(["a", "b", "c"]).join("");
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    expect(freq.size).toBe(6);
    for (const c of freq.values()) expect(Math.abs(c - N / 6)).toBeLessThan(N / 6 * 0.06);
  });

  it("weightedIndex follows the weights and ignores zero weights", () => {
    const rng = createRng(SEED);
    const counts = [0, 0, 0];
    const N = 40_000;
    for (let i = 0; i < N; i++) counts[rng.weightedIndex([0.25, 0, 0.75])]! += 1;
    expect(counts[1]).toBe(0);
    expect(counts[0]! / N).toBeCloseTo(0.25, 1);
    expect(counts[2]! / N).toBeCloseTo(0.75, 1);
  });

  it("rejects bad seeds and ranges", () => {
    expect(() => createRng("not-hex")).toThrow();
    expect(() => createRng(SEED).int(5, 1)).toThrow(RangeError);
    expect(() => createRng(SEED).pick([])).toThrow();
    expect(() => createRng(SEED).weightedIndex([0, 0])).toThrow();
  });

  it("newSeed returns 256 bits of hex", () => {
    const s = newSeed();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(newSeed()).not.toBe(s);
  });
});
