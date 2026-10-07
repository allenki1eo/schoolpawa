import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/quiz/rng";
import { instantiate, validateTemplate } from "@/lib/quiz/template";
import { SUBJECTS, TOPICS } from "./index";

/** Guards the seed content: every item must be well-formed and every template must instantiate. */
describe("seed content", () => {
  it("has unique topic codes linked to known subjects", () => {
    const codes = TOPICS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    const subjects = new Set(SUBJECTS.map((s) => s.code));
    for (const t of TOPICS) expect(subjects.has(t.subject), t.code).toBe(true);
  });

  it.each(TOPICS.map((t) => [t.code, t] as const))("%s: questions are well-formed", (_code, topic) => {
    expect(topic.lessons.length).toBeGreaterThanOrEqual(2);
    for (const q of topic.questions) {
      expect(q.answer.type).toBe(q.type);
      if (q.type === "mcq") {
        expect(q.options!.length).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options).size).toBe(q.options!.length);
        expect(q.answer.type === "mcq" && q.answer.correctIndex).toBeLessThan(q.options!.length);
      }
      if (q.type === "ordering" && q.answer.type === "ordering") {
        expect([...q.answer.order].sort()).toEqual(q.options!.map((_, i) => i));
      }
      expect(q.explanation.length).toBeGreaterThan(3);
    }
  });

  it.each(TOPICS.flatMap((t) => t.templates.map((tpl, i) => [`${t.code}#${i}`, tpl] as const)))("%s: template valid", (_k, tpl) => {
    expect(validateTemplate(tpl.spec)).toEqual([]);
    const rng = createRng("ab".repeat(32));
    for (let i = 0; i < 100; i++) {
      const { question } = instantiate(tpl.spec, rng);
      expect(question.prompt).not.toMatch(/\{\w+(:\w+)?\}/);
      expect(question.explanation).not.toMatch(/\{\w+(:\w+)?\}/);
      if (question.answer.type === "number") expect(Number.isFinite(question.answer.value)).toBe(true);
      if (question.type === "mcq") expect(new Set(question.options).size).toBe(4);
    }
  });

  it("every topic covers all three difficulties", () => {
    for (const t of TOPICS) {
      const ds = new Set([...t.questions.map((q) => q.d), ...t.templates.map((x) => x.d)]);
      expect([...ds].sort(), t.code).toEqual([1, 2, 3]);
    }
  });
});
