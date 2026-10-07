import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { audit } from "../audit";
import { afterCommit, releaseHeld, voidHeld } from "../ledger";
import type { Admin } from "./auth";

async function logAction(admin: Admin, targetType: string, targetId: string, action: string, note?: string) {
  await db.insert(schema.moderationActions).values({ adminId: admin.id, targetType, targetId, action, note });
  await audit({ actorType: "admin", actorId: admin.id, action: `moderation.${action}`, targetType, targetId, meta: note ? { note } : undefined });
}

export async function resolveReport(admin: Admin, reportId: string, action: "dismiss" | "suspend_student" | "archive_group") {
  const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
  if (!report) return;
  if (action === "suspend_student" && report.targetType === "student") {
    await db.update(schema.students).set({ status: "suspended" }).where(eq(schema.students.id, report.targetId));
  }
  if (action === "archive_group" && report.targetType === "group") {
    await db.update(schema.groups).set({ archived: true }).where(eq(schema.groups.id, report.targetId));
  }
  // Resolve every open report on the same target with the same decision.
  await db
    .update(schema.reports)
    .set({ status: action === "dismiss" ? "dismissed" : "actioned" })
    .where(and(eq(schema.reports.targetType, report.targetType), eq(schema.reports.targetId, report.targetId), eq(schema.reports.status, "open")));
  await logAction(admin, report.targetType, report.targetId, action);
}

export async function reinstateStudent(admin: Admin, studentId: string) {
  await db.update(schema.students).set({ status: "active" }).where(eq(schema.students.id, studentId));
  await logAction(admin, "student", studentId, "reinstate");
}

/**
 * Resolve an anomaly flag. For held quiz rounds, `release` appends release entries for the
 * held ledger rows (points start counting); `void` appends void markers (they never count).
 */
export async function resolveFlag(admin: Admin, flagId: string, decision: "release" | "void") {
  const [flag] = await db.select().from(schema.anomalyFlags).where(eq(schema.anomalyFlags.id, flagId));
  if (!flag || flag.status !== "open") return;
  const held = await db
    .select()
    .from(schema.pointsLedger)
    .where(
      and(
        eq(schema.pointsLedger.status, "held"),
        sql`${schema.pointsLedger.source} <> 'void'`,
        eq(schema.pointsLedger.refId, flag.entityId),
        sql`not exists (select 1 from points_ledger r where r.source in ('release','void') and r.ref_id = ${schema.pointsLedger.id}::text)`,
      ),
    );
  const released = await db.transaction(async (tx) => {
    const out: Array<Awaited<ReturnType<typeof releaseHeld>>> = [];
    for (const entry of held) {
      if (decision === "release") out.push(await releaseHeld(tx, entry.id));
      else await voidHeld(tx, entry.id);
    }
    await tx
      .update(schema.anomalyFlags)
      .set({ status: decision === "release" ? "resolved_ok" : "resolved_void", resolvedAt: new Date(), resolvedBy: admin.id })
      .where(eq(schema.anomalyFlags.id, flagId));
    return out;
  });
  for (const r of released) await afterCommit(r.studentId, [{ amount: r.amount, result: r.result }]);
  await logAction(admin, flag.entityType, flag.entityId, `flag_${decision}`, `${held.length} held entries`);
}
