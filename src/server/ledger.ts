import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db/client";
import { nextStreak } from "@/lib/ranking/levels";
import { localDate, weekStart } from "@/lib/time";
import { bumpStudentBoards, placeOf } from "./leaderboard";

export type LedgerSource = (typeof schema.ledgerSourceEnum.enumValues)[number];

export interface Award {
  studentId: string;
  amount: number;
  source: LedgerSource;
  /** Held points are visible as "pending" but excluded from every ranking until released. */
  held?: boolean;
  refId?: string;
}

export interface AwardResult {
  entryId: number;
  counted: boolean;
  week: string;
}

/**
 * The ONLY way points enter the system. Appends to the ledger and, for counted points, updates
 * the denormalised XP on the student row. Call `afterCommit` with the results once the
 * surrounding transaction has committed to refresh the leaderboard cache.
 */
export async function award(tx: Tx, a: Award): Promise<AwardResult | null> {
  if (a.amount <= 0) return null;
  const [student] = await tx
    .select({ schoolId: schema.students.schoolId, gradeLevelId: schema.students.gradeLevelId })
    .from(schema.students)
    .where(eq(schema.students.id, a.studentId));
  if (!student) throw new Error("award: unknown student");
  const week = weekStart();
  const status = a.held ? "held" : "counted";
  const [entry] = await tx
    .insert(schema.pointsLedger)
    .values({
      studentId: a.studentId,
      schoolId: student.schoolId,
      gradeLevelId: student.gradeLevelId,
      amount: Math.round(a.amount),
      source: a.source,
      status,
      refId: a.refId,
      weekStart: week,
    })
    .returning({ id: schema.pointsLedger.id });
  if (status === "counted") {
    await tx
      .update(schema.students)
      .set({ xp: sql`${schema.students.xp} + ${Math.round(a.amount)}` })
      .where(eq(schema.students.id, a.studentId));
  }
  return { entryId: entry!.id, counted: status === "counted", week };
}

/** Refresh caches for counted awards. Safe to call with nulls / held results. */
export async function afterCommit(studentId: string, results: Array<{ amount: number; result: AwardResult | null }>) {
  const counted = results.filter((r) => r.result?.counted);
  if (counted.length === 0) return;
  const place = await placeOf(studentId);
  if (!place) return;
  for (const r of counted) await bumpStudentBoards(place, Math.round(r.amount), r.result!.week);
}

/**
 * Release a held entry by appending a `release` entry (unique per held id). The held row is
 * never modified. Released points count in the week they are released.
 */
export async function releaseHeld(tx: Tx, heldEntryId: number) {
  const [held] = await tx.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.id, heldEntryId));
  if (!held || held.status !== "held") throw new Error("Not a held entry");
  const result = await award(tx, {
    studentId: held.studentId,
    amount: held.amount,
    source: "release",
    refId: String(held.id),
  });
  return { studentId: held.studentId, amount: held.amount, result };
}

/** Reject a held entry: append a `void` marker (status held, so it never counts). */
export async function voidHeld(tx: Tx, heldEntryId: number) {
  const [held] = await tx.select().from(schema.pointsLedger).where(eq(schema.pointsLedger.id, heldEntryId));
  if (!held || held.status !== "held" || held.source === "void") throw new Error("Not a held entry");
  await tx.insert(schema.pointsLedger).values({
    studentId: held.studentId,
    schoolId: held.schoolId,
    gradeLevelId: held.gradeLevelId,
    amount: held.amount,
    source: "void",
    status: "held",
    refId: String(held.id),
    weekStart: weekStart(),
  });
}

/** Mark today as active for the streak. */
export async function touchStreak(tx: Tx, studentId: string) {
  const [s] = await tx
    .select({ streak: schema.students.streakDays, last: schema.students.lastActiveDate })
    .from(schema.students)
    .where(eq(schema.students.id, studentId));
  if (!s) return 0;
  const today = localDate();
  const streak = nextStreak(s.streak, s.last, today);
  await tx
    .update(schema.students)
    .set({ streakDays: streak, lastActiveDate: today, lastSeenAt: new Date() })
    .where(eq(schema.students.id, studentId));
  return streak;
}

export async function pendingPoints(studentId: string): Promise<number> {
  const [row] = await db.execute<{ pending: string | null }>(sql`
    select sum(h.amount) as pending from points_ledger h
    where h.student_id = ${studentId} and h.status = 'held' and h.source <> 'void'
      and not exists (select 1 from points_ledger r where r.source in ('release', 'void') and r.ref_id = h.id::text)`);
  return Number(row?.pending ?? 0);
}
