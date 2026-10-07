import { compile, ExpressionError, variablesOf, type Scope } from "./expr";
import { createRng, type Rng } from "./rng";
import type { ConcreteQuestion } from "./types";

/**
 * Parametric question template.
 *
 * Example (stored as JSON in `question_templates.spec`):
 * {
 *   "type": "number",
 *   "prompt": "Duka linauza madaftari {n} kwa TZS {p} kila moja. Jumla ni shilingi ngapi?",
 *   "params": { "n": { "min": 3, "max": 12 }, "p": { "min": 300, "max": 1500, "step": 50 } },
 *   "answer": "n * p",
 *   "explanation": "{n} × {p} = {answer}",
 *   "unit": "TZS"
 * }
 */
export interface TemplateSpec {
  type: "number" | "mcq";
  prompt: string;
  params: Record<string, ParamSpec>;
  /** Named intermediate values, evaluated in insertion order; usable in prompt/answer/explanation. */
  derived?: Record<string, string>;
  /** Boolean expressions every instance must satisfy (e.g. "a > b", "total % 10 == 0"). */
  constraints?: string[];
  answer: string;
  /** Round the computed answer to this many decimal places. */
  decimals?: number;
  tolerance?: number;
  /** Expressions modelling common mistakes; required for `mcq`. */
  distractors?: string[];
  explanation: string;
  unit?: string;
}

export type ParamSpec = { min: number; max: number; step?: number } | { choices: number[] };

const MAX_ATTEMPTS = 200;

export class TemplateError extends Error {
  override name = "TemplateError";
}

function paramValues(spec: ParamSpec): number {
  if ("choices" in spec) return spec.choices.length;
  const step = spec.step ?? 1;
  return Math.floor((spec.max - spec.min) / step + 1e-9) + 1;
}

function drawParam(spec: ParamSpec, rng: Rng): number {
  if ("choices" in spec) return rng.pick(spec.choices);
  const step = spec.step ?? 1;
  const k = rng.int(0, paramValues(spec) - 1);
  return roundTo(spec.min + k * step, 10);
}

/** Upper bound on distinct instances (constraints may reduce it). */
export function variantSpace(spec: TemplateSpec): number {
  return Object.values(spec.params).reduce((acc, p) => acc * paramValues(p), 1);
}

/** Static validation run when an admin saves a template. Returns a list of problems. */
export function validateTemplate(spec: TemplateSpec): string[] {
  const problems: string[] = [];
  const known = new Set(Object.keys(spec.params));
  if (known.size === 0) problems.push("Template needs at least one parameter.");
  for (const [name, p] of Object.entries(spec.params)) {
    if ("choices" in p) {
      if (p.choices.length === 0) problems.push(`Parameter "${name}" has no choices.`);
    } else if (!(p.max >= p.min) || (p.step ?? 1) <= 0) {
      problems.push(`Parameter "${name}" has an invalid range.`);
    }
  }
  const check = (label: string, expr: string) => {
    try {
      compile(expr);
      for (const v of variablesOf(expr)) {
        if (!known.has(v)) problems.push(`${label} uses unknown variable "${v}".`);
      }
    } catch (e) {
      problems.push(`${label}: ${(e as Error).message}`);
    }
  };
  for (const [name, expr] of Object.entries(spec.derived ?? {})) {
    check(`Derived "${name}"`, expr);
    known.add(name);
  }
  (spec.constraints ?? []).forEach((c, i) => check(`Constraint ${i + 1}`, c));
  check("Answer", spec.answer);
  (spec.distractors ?? []).forEach((d, i) => check(`Distractor ${i + 1}`, d));
  if (spec.type === "mcq" && (spec.distractors?.length ?? 0) < 1) {
    problems.push("MCQ templates need at least one distractor expression.");
  }
  for (const m of spec.prompt.matchAll(/\{(\w+)(?::\w+)?\}/g)) {
    if (!known.has(m[1]!) && m[1] !== "answer") problems.push(`Prompt placeholder {${m[1]}} is not defined.`);
  }
  if (problems.length === 0) {
    // Smoke test: can we produce at least one valid instance?
    try {
      instantiate(spec, createRng("00".repeat(32)));
    } catch (e) {
      problems.push((e as Error).message);
    }
  }
  return problems;
}

export interface Instance {
  question: ConcreteQuestion;
  /** Drawn parameter values — stored so the exact instance can be re-created for grading/disputes. */
  params: Record<string, number>;
}

/** Draw parameters (respecting constraints) and build a concrete question. */
export function instantiate(spec: TemplateSpec, rng: Rng): Instance {
  const constraints = (spec.constraints ?? []).map((c) => compile(c));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const params: Record<string, number> = {};
    for (const [name, p] of Object.entries(spec.params)) params[name] = drawParam(p, rng);
    const scope = buildScope(spec, params);
    if (!scope) continue;
    if (constraints.every((c) => c(scope) !== 0)) {
      return { params, question: render(spec, params, rng) };
    }
  }
  throw new TemplateError("Could not satisfy template constraints — widen parameter ranges.");
}

/**
 * Re-create a concrete question from stored params. Distractor order is derived from `rng`, so
 * pass the same forked RNG used at serve time (or any RNG — grading only depends on `answer`).
 */
export function render(spec: TemplateSpec, params: Record<string, number>, rng: Rng): ConcreteQuestion {
  const scope = buildScope(spec, params);
  if (!scope) throw new TemplateError("Template produced a non-finite value.");
  const answer = computeAnswer(spec, scope);
  const full = { ...scope, answer };
  const prompt = fill(spec.prompt, full);
  const explanation = fill(spec.explanation, full);

  if (spec.type === "number") {
    return {
      type: "number",
      prompt,
      options: [],
      answer: { type: "number", value: answer, tolerance: spec.tolerance },
      explanation,
      unit: spec.unit,
    };
  }

  const options = buildDistractors(spec, scope, answer, rng);
  return {
    type: "mcq",
    prompt,
    options: [answer, ...options].map((v) => formatNumber(v) + (spec.unit ? ` ${spec.unit}` : "")),
    answer: { type: "mcq", correctIndex: 0 },
    explanation,
    unit: spec.unit,
  };
}

function buildScope(spec: TemplateSpec, params: Record<string, number>): Scope | null {
  const scope: Record<string, number> = { ...params };
  for (const [name, expr] of Object.entries(spec.derived ?? {})) {
    const v = compile(expr)(scope);
    if (!Number.isFinite(v)) return null;
    scope[name] = v;
  }
  return scope;
}

function computeAnswer(spec: TemplateSpec, scope: Scope): number {
  const raw = compile(spec.answer)(scope);
  if (!Number.isFinite(raw)) throw new ExpressionError("Answer is not a finite number.");
  return roundTo(raw, spec.decimals ?? 6);
}

function buildDistractors(spec: TemplateSpec, scope: Scope, answer: number, rng: Rng): number[] {
  const seen = new Set<string>([formatNumber(answer)]);
  const out: number[] = [];
  const add = (v: number) => {
    if (!Number.isFinite(v)) return;
    const value = roundTo(v, spec.decimals ?? 6);
    const key = formatNumber(value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  };
  for (const d of spec.distractors ?? []) {
    try {
      add(compile(d)(scope));
    } catch {
      /* a distractor that fails for these params is simply skipped */
    }
  }
  // Pad with plausible near-misses so there are always 3 distractors.
  const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(Math.abs(answer) || 1)) / 2);
  for (let i = 0; out.length < 3 && i < 30; i++) {
    const delta = rng.int(1, 4) * magnitude * (rng.float() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (answer >= 0 && candidate < 0) continue;
    add(candidate);
  }
  return out.slice(0, 3);
}

/**
 * Replace `{name}` with a formatted number (thousands separators), `{name:raw}` with the raw
 * value. Unknown placeholders are left intact so validation can catch them.
 */
export function fill(text: string, scope: Scope): string {
  return text.replace(/\{(\w+)(?::(raw))?\}/g, (whole, name: string, raw?: string) => {
    const v = scope[name];
    if (v === undefined) return whole;
    return raw ? String(v) : formatNumber(v);
  });
}

/** 1234567.5 → "1,234,567.5" (Tanzanian convention: comma thousands, dot decimal). */
export function formatNumber(v: number): string {
  const rounded = roundTo(v, 6);
  const [int, frac] = Math.abs(rounded).toString().split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${rounded < 0 ? "-" : ""}${grouped}${frac ? `.${frac}` : ""}`;
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((v + Number.EPSILON * Math.sign(v)) * f) / f;
}
