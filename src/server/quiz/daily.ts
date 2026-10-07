import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { dayNumber } from "@/lib/time";

/**
 * Daily Challenge topic for a grade: the same topic for everyone at that level today (each
 * student still gets different randomised questions). Rotates deterministically through the
 * grade's live topics; the first request of the day pins it in `daily_challenges` so adding a
 * topic mid-day can't change today's challenge.
 */
export async function dailyTopicFor(gradeLevelId: string, date: string) {
  const [pinned] = await db
    .select({ topic: schema.topics })
    .from(schema.dailyChallenges)
    .innerJoin(schema.topics, eq(schema.topics.id, schema.dailyChallenges.topicId))
    .where(and(eq(schema.dailyChallenges.gradeLevelId, gradeLevelId), eq(schema.dailyChallenges.date, date)));
  if (pinned) return pinned.topic;

  const live = await db
    .select()
    .from(schema.topics)
    .where(and(eq(schema.topics.gradeLevelId, gradeLevelId), eq(schema.topics.isLive, true)))
    .orderBy(asc(schema.topics.code));
  if (live.length === 0) return null;
  const topic = live[dayNumber(date) % live.length]!;
  await db.insert(schema.dailyChallenges).values({ date, gradeLevelId, topicId: topic.id }).onConflictDoNothing();
  // Re-read in case another request pinned a different topic first.
  const [winner] = await db
    .select({ topicId: schema.dailyChallenges.topicId })
    .from(schema.dailyChallenges)
    .where(and(eq(schema.dailyChallenges.gradeLevelId, gradeLevelId), eq(schema.dailyChallenges.date, date)));
  return live.find((t) => t.id === winner?.topicId) ?? topic;
}
