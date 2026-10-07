import { describe, expect, it } from "vitest";
import { createRng } from "./rng";
import { correctDisplay, displayedOptions, isCorrect, shuffleOptions } from "./shuffle";
import type { ConcreteQuestion } from "./types";

const SEED = "3d".repeat(32);

const mcq: ConcreteQuestion = {
  type: "mcq",
  prompt: "Mji mkuu wa Tanzania ni upi?",
  options: ["Dodoma", "Arusha", "Mwanza", "Tanga"],
  answer: { type: "mcq", correctIndex: 0 },
  explanation: "",
};

const ordering: ConcreteQuestion = {
  type: "ordering",
  prompt: "Panga kuanzia ndogo hadi kubwa",
  options: ["1/2", "1/4", "3/4"],
  answer: { type: "ordering", order: [1, 0, 2] },
  explanation: "",
};

describe("option shuffling", () => {
  it("maps displayed choices back to the canonical answer", () => {
    for (let i = 0; i < 50; i++) {
      const order = shuffleOptions(mcq, createRng(SEED).fork(String(i)));
      const shown = displayedOptions(mcq.options, order);
      const display = shown.indexOf("Dodoma");
      expect(correctDisplay(mcq.answer, order)).toBe(display);
      expect(isCorrect(mcq.answer, { type: "mcq", displayIndex: display }, order)).toBe(true);
      expect(isCorrect(mcq.answer, { type: "mcq", displayIndex: (display + 1) % 4 }, order)).toBe(false);
    }
  });

  it("puts the correct answer in every position over many attempts", () => {
    const positions = new Set<number>();
    for (let i = 0; i < 100; i++) positions.add(shuffleOptions(mcq, createRng(SEED).fork(`p${i}`)).indexOf(0));
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it("never shows an ordering question already solved", () => {
    for (let i = 0; i < 100; i++) {
      const order = shuffleOptions(ordering, createRng(SEED).fork(`o${i}`));
      const canonicalAsShown = order;
      expect(canonicalAsShown).not.toEqual([1, 0, 2]);
      const solution = correctDisplay(ordering.answer, order) as number[];
      expect(isCorrect(ordering.answer, { type: "ordering", displayOrder: solution }, order)).toBe(true);
    }
  });

  it("grades number, true/false and timeouts", () => {
    const num = { type: "number", value: 4500 } as const;
    expect(isCorrect(num, { type: "number", value: 4500 }, [])).toBe(true);
    expect(isCorrect(num, { type: "number", value: 4501 }, [])).toBe(false);
    expect(isCorrect({ type: "number", value: 2.5, tolerance: 0.01 }, { type: "number", value: 2.505 }, [])).toBe(true);
    expect(isCorrect({ type: "true_false", value: false }, { type: "true_false", value: false }, [])).toBe(true);
    expect(isCorrect(mcq.answer, { type: "timeout" }, [0, 1, 2, 3])).toBe(false);
    expect(isCorrect(mcq.answer, { type: "number", value: 0 }, [0, 1, 2, 3])).toBe(false);
  });
});
