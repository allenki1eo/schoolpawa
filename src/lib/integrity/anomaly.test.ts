import { describe, expect, it } from "vitest";
import { assessRound, coefficientOfVariation, isDeviceBurst, isSchoolSpike, median, questionHealth } from "./anomaly";

const answers = (times: number[], correct = true) => times.map((timeMs) => ({ timeMs, correct }));

describe("round assessment", () => {
  it("passes a normal human round", () => {
    expect(assessRound(answers([4200, 7300, 3100, 9800, 5600, 2900, 11000, 6400, 4800, 3900]))).toEqual([]);
  });

  it("flags a perfect round answered impossibly fast", () => {
    expect(assessRound(answers([600, 700, 650, 900, 800, 500, 1000, 700, 750, 2000]))).toContain("impossibly_fast");
  });

  it("does not flag fast but imperfect rounds as impossibly fast", () => {
    const a = answers([600, 700, 650, 900, 800, 500, 1000, 700, 750, 2000]);
    a[3]!.correct = false;
    expect(assessRound(a)).not.toContain("impossibly_fast");
  });

  it("flags machine-like identical timing", () => {
    expect(assessRound(answers([5000, 5010, 4995, 5005, 5000, 4990, 5002, 5008, 4999, 5001], false))).toContain("robotic_timing");
  });
});

describe("stats helpers", () => {
  it("median and CV", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(coefficientOfVariation([5, 5, 5])).toBe(0);
    expect(coefficientOfVariation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(0.4, 5);
  });
});

describe("school / device / question checks", () => {
  it("detects school spikes but ignores small numbers", () => {
    expect(isSchoolSpike(5000, [800, 900, 1000, 700])).toBe(true);
    expect(isSchoolSpike(2000, [800, 900, 1000, 700])).toBe(false);
    expect(isSchoolSpike(400, [10, 10])).toBe(false);
  });

  it("detects device profile bursts in a 24 h window", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const recent = [1, 2, 3, 4].map((h) => new Date(now.getTime() - h * 3600_000));
    expect(isDeviceBurst(recent, now)).toBe(true);
    expect(isDeviceBurst(recent.slice(0, 3), now)).toBe(false);
    expect(isDeviceBurst([...recent.slice(0, 3), new Date("2026-10-01")], now)).toBe(false);
  });

  it("question health", () => {
    expect(questionHealth(10, 0)).toBe("ok");
    expect(questionHealth(100, 10)).toBe("suspect_key");
    expect(questionHealth(100, 99)).toBe("too_easy");
    expect(questionHealth(100, 60)).toBe("ok");
  });
});
