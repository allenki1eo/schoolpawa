import { describe, expect, it } from "vitest";
import { compile, evaluate, ExpressionError, variablesOf } from "./expr";
import { createRng } from "./rng";
import { fill, formatNumber, instantiate, render, validateTemplate, variantSpace, type TemplateSpec } from "./template";

const SEED = "7c".repeat(32);

describe("expression evaluator", () => {
  it("respects precedence and associativity", () => {
    expect(evaluate("2 + 3 * 4", {})).toBe(14);
    expect(evaluate("(2 + 3) * 4", {})).toBe(20);
    expect(evaluate("10 - 4 - 3", {})).toBe(3);
    expect(evaluate("2 ^ 3 ^ 2", {})).toBe(512);
    expect(evaluate("-2 ^ 2", {})).toBe(-4);
    expect(evaluate("17 % 5", {})).toBe(2);
  });

  it("supports variables, functions and comparisons", () => {
    expect(evaluate("n * p", { n: 4, p: 250 })).toBe(1000);
    expect(evaluate("round(a / b * 100, 1)", { a: 1, b: 3 })).toBe(33.3);
    expect(evaluate("gcd(12, 18) + lcm(4, 6)", {})).toBe(18);
    expect(evaluate("a > b && b >= 2", { a: 5, b: 2 })).toBe(1);
    expect(evaluate("a == b || !(a < b)", { a: 1, b: 2 })).toBe(0);
    expect(evaluate("0.1 + 0.2 == 0.3", {})).toBe(1);
  });

  it("refuses anything outside the whitelist", () => {
    expect(() => compile("process.exit()")).toThrow(ExpressionError);
    expect(() => compile("constructor(1)")).toThrow(/Unknown function/);
    expect(() => evaluate("x + 1", {})).toThrow(/Unknown variable/);
    expect(() => evaluate("constructor + 1", {})).toThrow(/Unknown variable/);
    expect(() => evaluate("toString(1)", {})).toThrow(/Unknown function/);
    expect(() => compile("1 +")).toThrow(ExpressionError);
    expect(() => compile("a; b")).toThrow(ExpressionError);
    expect(() => compile("`x`")).toThrow(ExpressionError);
  });

  it("lists referenced variables", () => {
    expect(variablesOf("round(n * p / q, 2)").sort()).toEqual(["n", "p", "q"]);
  });
});

describe("formatting", () => {
  it("uses comma thousands separators", () => {
    expect(formatNumber(1500)).toBe("1,500");
    expect(formatNumber(1234567.25)).toBe("1,234,567.25");
    expect(formatNumber(-42000)).toBe("-42,000");
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });
  it("fills placeholders", () => {
    expect(fill("{n} × {p} = {answer} ({p:raw})", { n: 3, p: 1500, answer: 4500 })).toBe("3 × 1,500 = 4,500 (1500)");
    expect(fill("{missing}", {})).toBe("{missing}");
  });
});

const shop: TemplateSpec = {
  type: "number",
  prompt: "Duka linauza madaftari {n} kwa TZS {p} kila moja. Jumla ni shilingi ngapi?",
  params: { n: { min: 3, max: 12 }, p: { min: 300, max: 1500, step: 50 } },
  answer: "n * p",
  explanation: "{n} × {p} = {answer}",
  unit: "TZS",
};

const percent: TemplateSpec = {
  type: "mcq",
  prompt: "Bei ya shati ni TZS {price}. Imepunguzwa kwa {pct}%. Bei mpya ni ipi?",
  params: { price: { min: 5000, max: 40000, step: 1000 }, pct: { choices: [10, 20, 25, 50] } },
  derived: { cut: "price * pct / 100" },
  constraints: ["cut % 100 == 0"],
  answer: "price - cut",
  distractors: ["cut", "price + cut", "price - pct"],
  explanation: "{pct}% ya {price} ni {cut}; {price} − {cut} = {answer}",
  unit: "TZS",
};

describe("templates", () => {
  it("validates good templates and catches mistakes", () => {
    expect(validateTemplate(shop)).toEqual([]);
    expect(validateTemplate(percent)).toEqual([]);
    expect(validateTemplate({ ...shop, answer: "n * q" })).toContain('Answer uses unknown variable "q".');
    expect(validateTemplate({ ...shop, prompt: "{zzz}" })[0]).toMatch(/zzz/);
    expect(validateTemplate({ ...percent, distractors: [] })[0]).toMatch(/distractor/);
    expect(validateTemplate({ ...shop, constraints: ["n > 100"] })[0]).toMatch(/constraints/);
  });

  it("computes the answer on the server from drawn params", () => {
    const { question, params } = instantiate(shop, createRng(SEED));
    expect(question.type).toBe("number");
    expect(question.answer).toEqual({ type: "number", value: params.n! * params.p!, tolerance: undefined });
    expect(params.p! % 50).toBe(0);
    expect(question.prompt).not.toMatch(/\{/);
  });

  it("respects constraints across many draws", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 300; i++) {
      const { params } = instantiate(percent, rng);
      expect((params.price! * params.pct!) / 100 % 100).toBe(0);
    }
  });

  it("builds 4 distinct MCQ options with the correct one at canonical index 0", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 200; i++) {
      const { question, params } = instantiate(percent, rng);
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      const expected = params.price! - (params.price! * params.pct!) / 100;
      expect(question.options[0]).toBe(`${formatNumber(expected)} TZS`);
      expect(question.answer).toEqual({ type: "mcq", correctIndex: 0 });
    }
  });

  it("re-renders the identical question from stored params (grading/disputes)", () => {
    const { question, params } = instantiate(percent, createRng(SEED).fork("a"));
    const again = render(percent, params, createRng(SEED).fork("b"));
    expect(again.prompt).toBe(question.prompt);
    expect(again.answer).toEqual(question.answer);
  });

  it("produces many distinct variants", () => {
    expect(variantSpace(shop)).toBe(10 * 25);
    const rng = createRng(SEED);
    const prompts = new Set(Array.from({ length: 100 }, () => instantiate(shop, rng).question.prompt));
    expect(prompts.size).toBeGreaterThan(70);
  });
});
