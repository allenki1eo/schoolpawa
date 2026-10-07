import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db/client";
import { audit, type ActorType } from "./audit";
import { reassignOwnershipIfNeeded } from "./groups";
import { ApiError } from "./http";

/**
 * Data-subject rights (PDPA): export and erasure of a child's data, plus the retention purge.
 *
 * Erasure is the ONLY code path allowed to delete ledger rows. It sets the transaction-local
 * `schoolpawa.erasure` flag that the append-only trigger checks. What survives erasure:
 *  - the consent record (proof consent existed), with student_id nulled and withdrawn_at set;
 *  - audit-log rows (ids only, no personal data);
 *  - aggregate ranking snapshots (school-level, no child data).
 */

export async function guardianChildren(guardianId: string) {
  return db
    .select({
      id: schema.students.id,
      nickname: schema.students.nickname,
      discriminator: schema.students.discriminator,
      avatar: schema.students.avatar,
      gradeLevelId: schema.students.gradeLevelId,
      schoolName: schema.schools.name,
      xp: schema.students.xp,
      createdAt: schema.students.createdAt,
      lastSeenAt: schema.students.lastSeenAt,
    })
    .from(schema.students)
    .innerJoin(schema.schools, eq(schema.schools.id, schema.students.schoolId))
    .where(eq(schema.students.guardianId, guardianId));
}

async function assertGuardianOf(guardianId: string, studentId: string) {
  const [s] = await db.select({ g: schema.students.guardianId }).from(schema.students).where(eq(schema.students.id, studentId));
  if (!s || s.g !== guardianId) throw new ApiError(404, "child_not_found");
}

/** Everything we hold about one child, as plain JSON (right of access / portability). */
export async function exportChild(guardianId: string, studentId: string) {
  await assertGuardianOf(guardianId, studentId);
  const [student] = await db.select().from(schema.students).where(eq(schema.students.id, studentId));
  const { pinHash: _pin, ...profile } = student!;
  void _pin;
  const [school] = await db.select({ name: schema.schools.name, regNo: schema.schools.regNo }).from(schema.schools).where(eq(schema.schools.id, profile.schoolId));
  const consents = await db
    .select({ policyVersion: schema.consents.policyVersion, grantedAt: schema.consents.grantedAt, method: schema.consents.method })
    .from(schema.consents)
    .where(eq(schema.consents.studentId, studentId));
  const sessions = await db
    .select({
      kind: schema.quizSessions.kind,
      topicId: schema.quizSessions.topicId,
      score: schema.quizSessions.score,
      correct: schema.quizSessions.correctCount,
      startedAt: schema.quizSessions.startedAt,
      finishedAt: schema.quizSessions.finishedAt,
    })
    .from(schema.quizSessions)
    .where(eq(schema.quizSessions.studentId, studentId))
    .orderBy(desc(schema.quizSessions.startedAt));
  const points = await db
    .select({ amount: schema.pointsLedger.amount, source: schema.pointsLedger.source, status: schema.pointsLedger.status, createdAt: schema.pointsLedger.createdAt })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.studentId, studentId));
  const groups = await db
    .select({ name: schema.groups.name, joinedAt: schema.groupMembers.joinedAt })
    .from(schema.groupMembers)
    .innerJoin(schema.groups, eq(schema.groups.id, schema.groupMembers.groupId))
    .where(eq(schema.groupMembers.studentId, studentId));

  await audit({ actorType: "guardian", actorId: guardianId, action: "privacy.export", targetType: "student", targetId: studentId });
  return {
    exportedAt: new Date().toISOString(),
    note: "School Pawa holds no real names, birthdates, photos or locations. Phone numbers are stored only as a one-way hash.",
    profile: { ...profile, school },
    consents,
    sessions,
    points,
    groups,
  };
}

export async function eraseStudent(studentId: string, actor: { type: ActorType; id: string | null; reason: string }, existingTx?: Tx) {
  const run = async (tx: Tx) => {
    await tx.execute(sql`set local schoolpawa.erasure = 'on'`);
    const memberships = await tx
      .select({ groupId: schema.groupMembers.groupId })
      .from(schema.groupMembers)
      .where(eq(schema.groupMembers.studentId, studentId));
    await tx.delete(schema.groupMembers).where(eq(schema.groupMembers.studentId, studentId));
    for (const m of memberships) await reassignOwnershipIfNeeded(tx, m.groupId, studentId);
    // Groups the student created but no longer belongs to.
    const created = await tx.select({ id: schema.groups.id }).from(schema.groups).where(eq(schema.groups.creatorId, studentId));
    for (const g of created) await reassignOwnershipIfNeeded(tx, g.id, studentId);

    await tx.delete(schema.pointsLedger).where(eq(schema.pointsLedger.studentId, studentId));
    await tx
      .update(schema.consents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(schema.consents.studentId, studentId), sql`${schema.consents.withdrawnAt} is null`));
    // Cascades: device profiles, sessions, answers, seen questions, challenges, reactions, blocks, offline data.
    await tx.delete(schema.students).where(eq(schema.students.id, studentId));
    await audit({ actorType: actor.type, actorId: actor.id, action: "privacy.erase", targetType: "student", targetId: studentId, meta: { reason: actor.reason } }, tx);
  };
  if (existingTx) await run(existingTx);
  else await db.transaction(run);
}

export async function eraseChildByGuardian(guardianId: string, studentId: string) {
  await assertGuardianOf(guardianId, studentId);
  await eraseStudent(studentId, { type: "guardian", id: guardianId, reason: "guardian_request" });
}

/**
 * Retention: erase profiles inactive for RETENTION_INACTIVE_DAYS, delete spent OTP requests,
 * and purge audit rows older than two years.
 */
export async function runRetention(inactiveDays: number) {
  const cutoff = new Date(Date.now() - inactiveDays * 86_400_000);
  const stale = await db.select({ id: schema.students.id }).from(schema.students).where(lt(schema.students.lastSeenAt, cutoff)).limit(500);
  for (const s of stale) await eraseStudent(s.id, { type: "system", id: null, reason: "retention_inactive" });

  const otps = await db
    .delete(schema.otpRequests)
    .where(lt(schema.otpRequests.createdAt, new Date(Date.now() - 86_400_000)))
    .returning({ id: schema.otpRequests.id });

  const auditCutoff = new Date(Date.now() - 2 * 365 * 86_400_000);
  const purged = await db.transaction(async (tx) => {
    await tx.execute(sql`set local schoolpawa.erasure = 'on'`);
    return tx.delete(schema.auditLog).where(lt(schema.auditLog.createdAt, auditCutoff)).returning({ id: schema.auditLog.id });
  });

  // Orphaned devices with no profiles left.
  await db.execute(sql`delete from devices d where not exists (select 1 from device_profiles p where p.device_id = d.id) and d.last_seen_at < ${cutoff}`);
  await audit({ actorType: "system", action: "retention.run", meta: { erasedProfiles: stale.length, otpsDeleted: otps.length, auditPurged: purged.length } });
  return { erasedProfiles: stale.length, otpsDeleted: otps.length, auditPurged: purged.length };
}

