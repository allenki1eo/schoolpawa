import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const BADGES = ["first_round", "perfect_round", "streak_3", "streak_7", "streak_30", "first_win", "group_founder", "daily_5"] as const;
export type BadgeKey = (typeof BADGES)[number];

/** Badges are derived from existing records (no extra state to keep consistent). */
export async function earnedBadges(studentId: string, streakDays: number): Promise<Set<BadgeKey>> {
  const [row] = await db.execute<{ rounds: string; perfect: string; dailies: string; wins: string; founded: string }>(sql`
    select
      (select count(*) from quiz_sessions where student_id = ${studentId} and status = 'completed') as rounds,
      (select count(*) from quiz_sessions where student_id = ${studentId} and status = 'completed' and correct_count = question_count) as perfect,
      (select count(*) from quiz_sessions where student_id = ${studentId} and status = 'completed' and kind = 'daily') as dailies,
      (select count(*) from challenges where winner_id = ${studentId}) as wins,
      (select count(*) from groups where creator_id = ${studentId}) as founded`);
  const n = (k: keyof NonNullable<typeof row>) => Number(row?.[k] ?? 0);
  const out = new Set<BadgeKey>();
  if (n("rounds") > 0) out.add("first_round");
  if (n("perfect") > 0) out.add("perfect_round");
  if (streakDays >= 3) out.add("streak_3");
  if (streakDays >= 7) out.add("streak_7");
  if (streakDays >= 30) out.add("streak_30");
  if (n("wins") > 0) out.add("first_win");
  if (n("founded") > 0) out.add("group_founder");
  if (n("dailies") >= 5) out.add("daily_5");
  return out;
}
