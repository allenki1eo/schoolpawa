/**
 * Demo activity for local development and design review: ~70 students across the sample
 * schools with two weeks of ledger history, so leaderboards, School Power and the improvement
 * awards have something to show. Guardian phone hashes are random (no real numbers).
 * NEVER run in production (guarded in index.ts).
 */
import { randomBytes } from "node:crypto";
import { eq, like, sql } from "drizzle-orm";
import { db, schema } from "../client";
import { hashSecret } from "@/server/crypto";
import { AVATARS } from "@/lib/safety/presets";
import { addDays, weekStart } from "@/lib/time";

const NICKS = [
  "Simba", "Neema", "Baraka", "Zawadi", "Tumaini", "Jasiri", "Imani", "Upendo", "Shujaa", "Nyota", "Radi", "Faraja",
  "Amani", "Kito", "Malkia", "Bahati", "Pendo", "Tausi", "Hodari", "Mwamba", "Jua", "Tai", "Duma", "Kimbunga",
  "Kipaji", "Mshindi", "Furaha", "Subira", "Hekima", "Busara", "Nuru", "Mwanga", "Chui", "Twiga", "Kasuku",
];

/** A live regional tournament per stage for the current week (idempotent). */
async function seedDemoTournaments() {
  const [existing] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.tournaments);
  if ((existing?.n ?? 0) > 0) return;
  const topics = await db.select().from(schema.topics);
  const thisWeek = weekStart();
  // A live regional tournament for each stage (this week) so the feature is visible in dev.
  const [region] = await db.select().from(schema.regions).limit(1);
  for (const stage of ["primary", "secondary"] as const) {
    const grade = stage === "primary" ? "std7" : "form4";
    const ids = topics.filter((t) => t.gradeLevelId === grade && t.isLive).map((t) => t.id);
    await db.insert(schema.tournaments).values({
      titleSw: stage === "primary" ? "Kombe la Shinyanga: Wiki ya Sayansi na Hisabati" : "Shinyanga Cup: STEM Week",
      titleEn: stage === "primary" ? "Shinyanga Cup: Science & Maths Week" : "Shinyanga Cup: STEM Week",
      stage,
      regionId: region?.id ?? null,
      topicIds: ids,
      startsAt: new Date(`${thisWeek}T00:00:00+03:00`),
      endsAt: new Date(new Date(`${thisWeek}T00:00:00+03:00`).getTime() + 7 * 86_400_000 - 1000),
    });
  }
  console.log("✓ demo: live tournaments for this week");
}

export async function seedDemo() {
  await seedDemoTournaments();
  const [already] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.students).where(like(schema.students.nickname, "%Demo%"));
  if ((already?.n ?? 0) > 0) {
    console.log("• demo data already present");
    return;
  }
  const schools = await db.select().from(schema.schools);
  const topics = await db.select().from(schema.topics);
  const pinHash = await hashSecret("1234");
  const thisWeek = weekStart();
  const lastWeek = addDays(thisWeek, -7);
  let created = 0;

  for (const school of schools) {
    const grade = school.stage === "primary" ? "std7" : "form4";
    const topic = topics.find((t) => t.gradeLevelId === grade);
    if (!topic) continue;
    // Bigger schools get more players, but small schools can still be strong.
    const players = Math.max(1, Math.round(school.enrolledEstimate / 400) + (randomInt(3)));
    const skill = 0.6 + Math.random() * 0.8;
    for (let i = 0; i < players; i++) {
      const [guardian] = await db.insert(schema.guardians).values({ phoneHash: `demo-${randomBytes(16).toString("hex")}` }).returning();
      const nickname = `${NICKS[(created * 7 + i) % NICKS.length]} Demo`;
      const [student] = await db
        .insert(schema.students)
        .values({
          nickname,
          discriminator: 1000 + created,
          avatar: AVATARS[created % AVATARS.length]!,
          gradeLevelId: grade,
          schoolId: school.id,
          guardianId: guardian!.id,
          pinHash,
          rating: 900 + randomInt(300),
        })
        .returning();
      created++;

      let xp = 0;
      for (const [week, factor] of [[lastWeek, 0.7 + Math.random() * 0.6], [thisWeek, 0.7 + Math.random() * 0.9]] as const) {
        const rounds = 3 + randomInt(6);
        for (let r = 0; r < rounds; r++) {
          const score = Math.round((60 + randomInt(90)) * skill * factor);
          const at = new Date(`${week}T09:00:00+03:00`);
          at.setDate(at.getDate() + randomInt(week === thisWeek ? Math.max(1, new Date().getDay()) : 7));
          const [session] = await db
            .insert(schema.quizSessions)
            .values({
              studentId: student!.id,
              kind: "practice",
              topicId: topic.id,
              seed: randomBytes(32).toString("hex"),
              questionCount: 10,
              status: "completed",
              score,
              correctCount: Math.min(10, Math.round(score / 13)),
              startedAt: at,
              finishedAt: at,
            })
            .returning({ id: schema.quizSessions.id });
          await db.insert(schema.pointsLedger).values({
            studentId: student!.id,
            schoolId: school.id,
            gradeLevelId: grade,
            amount: score,
            source: "quiz",
            status: "counted",
            refId: session!.id,
            weekStart: week,
            createdAt: at,
          });
          xp += score;
        }
      }
      await db.update(schema.students).set({ xp, streakDays: 1 + randomInt(9), lastActiveDate: addDays(thisWeek, 0) }).where(eq(schema.students.id, student!.id));
    }
  }
  console.log(`✓ demo: ${created} students with two weeks of activity (PIN 1234)`);
  console.log("  Rebuild the Redis leaderboard cache from the admin dashboard (or it fills as people play).");
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}
