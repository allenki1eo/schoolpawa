import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { QUESTION_FLAG_REASONS, REPORT_REASONS } from "@/lib/safety/presets";
import { audit } from "./audit";
import { config } from "./config";
import { ApiError } from "./http";
import { rateLimit } from "./rate-limit";
import { refreshTopicLiveness } from "./quiz/content";

type Student = typeof schema.students.$inferSelect;
type Target = "student" | "group" | "question";

/**
 * Report a profile, group or question. Questions with ≥ FLAG_THRESHOLD open flags are pulled
 * out of selection and back into review automatically (PRD §4.2).
 */
export async function report(student: Student, targetType: Target, targetId: string, reason: string) {
  await rateLimit("report", student.id);
  const allowed: readonly string[] = targetType === "question" ? QUESTION_FLAG_REASONS : REPORT_REASONS;
  if (!allowed.includes(reason)) throw new ApiError(400, "reason_invalid");
  if (targetType === "student" && targetId === student.id) throw new ApiError(400, "cannot_report_self");

  const inserted = await db
    .insert(schema.reports)
    .values({ reporterId: student.id, targetType, targetId, reason })
    .onConflictDoNothing()
    .returning({ id: schema.reports.id });
  if (inserted.length === 0) return { duplicate: true };

  if (targetType === "question") {
    const [open] = await db
      .select({ n: count() })
      .from(schema.reports)
      .where(and(eq(schema.reports.targetType, "question"), eq(schema.reports.targetId, targetId), eq(schema.reports.status, "open")));
    const [question] = await db
      .update(schema.questions)
      .set({ flagCount: open?.n ?? 0 })
      .where(eq(schema.questions.id, targetId))
      .returning();
    if (question && question.status === "approved" && (open?.n ?? 0) >= config.FLAG_THRESHOLD) {
      await db
        .update(schema.questions)
        .set({ status: "in_review", reviewNote: "Auto-pulled: student flags reached threshold", updatedAt: new Date() })
        .where(eq(schema.questions.id, targetId));
      await refreshTopicLiveness(question.topicId);
      await audit({ actorType: "system", action: "question.auto_pulled", targetType: "question", targetId, meta: { flags: open?.n } });
    }
  }
  return { duplicate: false };
}

export async function block(student: Student, blockedId: string) {
  if (blockedId === student.id) throw new ApiError(400, "cannot_block_self");
  await db.insert(schema.blocks).values({ blockerId: student.id, blockedId }).onConflictDoNothing();
  // A block also cancels open challenges between the two students.
  await db
    .update(schema.challenges)
    .set({ status: "declined" })
    .where(
      and(
        eq(schema.challenges.status, "open"),
        // either direction
        eq(schema.challenges.challengerId, student.id),
        eq(schema.challenges.opponentId, blockedId),
      ),
    );
  await db
    .update(schema.challenges)
    .set({ status: "declined" })
    .where(and(eq(schema.challenges.status, "open"), eq(schema.challenges.challengerId, blockedId), eq(schema.challenges.opponentId, student.id)));
}

export async function unblock(student: Student, blockedId: string) {
  await db.delete(schema.blocks).where(and(eq(schema.blocks.blockerId, student.id), eq(schema.blocks.blockedId, blockedId)));
}
