import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { validateTemplate, type TemplateSpec } from "@/lib/quiz/template";
import type { CanonicalAnswer } from "@/lib/quiz/types";
import { audit } from "../audit";
import { refreshTopicLiveness } from "../quiz/content";
import type { Admin } from "./auth";

/**
 * Content pipeline (PRD §4.2): draft → in_review → approved → retired.
 *
 * Copyright & quality rules enforced here, at the only place content can go live:
 *  - `ai_draft` may only be approved by an admin flagged as a qualified teacher;
 *  - `licensed` and `teacher_submitted` content must reference a recorded licence;
 *  - nobody approves their own content (four-eyes principle).
 */
export type ContentKind = "question" | "template";
export type Transition = "submit" | "approve" | "reject" | "retire" | "restore";

export class PipelineError extends Error {
  override name = "PipelineError";
}

const ALLOWED: Record<Transition, { from: string[]; to: "draft" | "in_review" | "approved" | "retired" }> = {
  submit: { from: ["draft"], to: "in_review" },
  approve: { from: ["in_review"], to: "approved" },
  reject: { from: ["in_review", "approved"], to: "draft" },
  retire: { from: ["approved", "in_review", "draft"], to: "retired" },
  restore: { from: ["retired"], to: "draft" },
};

export function approvalProblems(
  item: { sourceType: string; licenseId: string | null; authorId: string | null },
  admin: Pick<Admin, "id" | "isQualifiedTeacher" | "role">,
): string[] {
  const problems: string[] = [];
  if (item.sourceType === "ai_draft" && !admin.isQualifiedTeacher) {
    problems.push("AI-drafted content must be approved by a qualified teacher.");
  }
  if ((item.sourceType === "licensed" || item.sourceType === "teacher_submitted") && !item.licenseId) {
    problems.push("Licensed and teacher-submitted content needs a recorded licence before approval.");
  }
  if (item.authorId && item.authorId === admin.id) problems.push("You cannot approve content you wrote.");
  return problems;
}

export async function transition(admin: Admin, kind: ContentKind, id: string, action: Transition, note?: string) {
  const table = kind === "question" ? schema.questions : schema.questionTemplates;
  const [item] = await db.select().from(table).where(eq(table.id, id));
  if (!item) throw new PipelineError("Not found");
  const rule = ALLOWED[action];
  if (!rule.from.includes(item.status)) throw new PipelineError(`Cannot ${action} from ${item.status}`);
  if (action === "approve") {
    const problems = approvalProblems(item, admin);
    if (kind === "template") problems.push(...validateTemplate((item as typeof schema.questionTemplates.$inferSelect).spec));
    if (problems.length) throw new PipelineError(problems.join(" "));
  }
  if (action === "reject" && !note) throw new PipelineError("A rejection needs a note for the author.");

  await db
    .update(table)
    .set({
      status: rule.to,
      reviewerId: action === "approve" || action === "reject" ? admin.id : item.reviewerId,
      reviewNote: note ?? item.reviewNote,
      updatedAt: new Date(),
      ...(action === "approve" ? { flagCount: 0 } : {}),
    })
    .where(eq(table.id, id));
  if (action === "approve" && kind === "question") {
    // Approving clears outstanding flags: they were reviewed as part of this decision.
    await db
      .update(schema.reports)
      .set({ status: "actioned" })
      .where(and(eq(schema.reports.targetType, "question"), eq(schema.reports.targetId, id), eq(schema.reports.status, "open")));
  }
  await refreshTopicLiveness(item.topicId);
  await audit({ actorType: "admin", actorId: admin.id, action: `content.${action}`, targetType: kind, targetId: id, meta: { note } });
}

export interface QuestionInput {
  topicId: string;
  subTopic: string;
  syllabusRef: string;
  difficulty: 1 | 2 | 3;
  language: "sw" | "en";
  sourceType: "original" | "ai_draft" | "teacher_submitted" | "licensed";
  licenseId?: string | null;
  type: "mcq" | "true_false" | "number" | "ordering";
  prompt: string;
  options: string[];
  answer: CanonicalAnswer;
  explanation: string;
}

export function validateQuestion(q: QuestionInput): string[] {
  const p: string[] = [];
  if (q.prompt.trim().length < 5) p.push("Prompt is too short.");
  if (q.explanation.trim().length < 3) p.push("An explanation is required.");
  if (q.answer.type !== q.type) p.push("Answer type does not match question type.");
  if (q.type === "mcq") {
    if (q.options.length < 2 || q.options.length > 5) p.push("MCQ needs 2–5 options.");
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) p.push("Options must be distinct.");
    if (q.answer.type === "mcq" && (q.answer.correctIndex < 0 || q.answer.correctIndex >= q.options.length)) p.push("Correct option is out of range.");
  }
  if (q.type === "ordering") {
    if (q.options.length < 3 || q.options.length > 6) p.push("Ordering needs 3–6 items.");
    if (q.answer.type === "ordering" && [...q.answer.order].sort().join() !== q.options.map((_, i) => i).join()) p.push("Order must use each item once.");
  }
  if (q.type === "number" && q.answer.type === "number" && !Number.isFinite(q.answer.value)) p.push("Numeric answer is invalid.");
  return p;
}

export async function createQuestion(admin: Admin, input: QuestionInput) {
  const problems = validateQuestion(input);
  if (problems.length) throw new PipelineError(problems.join(" "));
  const [q] = await db
    .insert(schema.questions)
    .values({ ...input, licenseId: input.licenseId || null, authorId: admin.id, authorLabel: admin.name, status: "draft" })
    .returning({ id: schema.questions.id });
  await audit({ actorType: "admin", actorId: admin.id, action: "content.create", targetType: "question", targetId: q!.id });
  return q!.id;
}

export async function createTemplate(admin: Admin, input: Omit<QuestionInput, "type" | "prompt" | "options" | "answer" | "explanation"> & { spec: TemplateSpec }) {
  const problems = validateTemplate(input.spec);
  if (problems.length) throw new PipelineError(problems.join(" "));
  const [t] = await db
    .insert(schema.questionTemplates)
    .values({ ...input, licenseId: input.licenseId || null, authorId: admin.id, authorLabel: admin.name, status: "draft" })
    .returning({ id: schema.questionTemplates.id });
  await audit({ actorType: "admin", actorId: admin.id, action: "content.create", targetType: "template", targetId: t!.id });
  return t!.id;
}
