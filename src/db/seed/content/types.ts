import type { TemplateSpec } from "@/lib/quiz/template";
import type { CanonicalAnswer, QuestionType } from "@/lib/quiz/types";

/**
 * Seed content is ORIGINAL work by the School Pawa content team (source_type = "original").
 * Syllabus references name the topic; exact TIE syllabus codes must be confirmed by the
 * curriculum reviewer before launch. All items must pass a qualified-teacher review in
 * production (SEED_APPROVE_CONTENT=false seeds them as `in_review`).
 */
export interface SeedQuestion {
  sub: string;
  d: 1 | 2 | 3;
  type: QuestionType;
  prompt: string;
  options?: string[];
  answer: CanonicalAnswer;
  explanation: string;
}

export interface SeedTemplate {
  sub: string;
  d: 1 | 2 | 3;
  spec: TemplateSpec;
}

export interface SeedLesson {
  title: string;
  body: string;
  example?: string;
}

export interface SeedTopic {
  code: string;
  subject: string;
  grade: string;
  nameSw: string;
  nameEn: string;
  syllabusRef: string;
  language: "sw" | "en";
  lessons: SeedLesson[];
  questions: SeedQuestion[];
  templates: SeedTemplate[];
}

// Small helpers to keep the content files readable.
export const mcq = (sub: string, d: 1 | 2 | 3, prompt: string, options: string[], correctIndex: number, explanation: string): SeedQuestion => ({
  sub, d, type: "mcq", prompt, options, answer: { type: "mcq", correctIndex }, explanation,
});
export const tf = (sub: string, d: 1 | 2 | 3, prompt: string, value: boolean, explanation: string): SeedQuestion => ({
  sub, d, type: "true_false", prompt, answer: { type: "true_false", value }, explanation,
});
export const num = (sub: string, d: 1 | 2 | 3, prompt: string, value: number, explanation: string): SeedQuestion => ({
  sub, d, type: "number", prompt, answer: { type: "number", value }, explanation,
});
/** `correct` lists the options in the right order; options are stored in the given (shuffled) order. */
export const order = (sub: string, d: 1 | 2 | 3, prompt: string, options: string[], correct: string[], explanation: string): SeedQuestion => ({
  sub, d, type: "ordering", prompt, options, answer: { type: "ordering", order: correct.map((c) => {
    const i = options.indexOf(c);
    if (i < 0) throw new Error(`Ordering option "${c}" not found in "${prompt}"`);
    return i;
  }) }, explanation,
});
