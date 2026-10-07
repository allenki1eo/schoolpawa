/**
 * Seed: grade levels, subjects, topics, lessons, questions, templates, the first admin and the
 * Shinyanga sample schools. Idempotent — safe to re-run.
 *
 *   pnpm db:seed            content + admin + schools
 *   pnpm db:seed --demo     …plus demo students with two weeks of activity (dev only)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { db, pg, schema } from "../client";
import { hashSecret } from "@/server/crypto";
import { refreshTopicLiveness } from "@/server/quiz/content";
import { importSchoolsCsv } from "@/server/admin/import-schools";
import { GRADE_LEVELS, SUBJECTS, TOPICS } from "./content";
import { seedDemo } from "./demo";

const approve = process.env.SEED_APPROVE_CONTENT === "true";
const status = approve ? "approved" : "in_review";

async function main() {
  if (process.env.NODE_ENV === "production" && approve) throw new Error("SEED_APPROVE_CONTENT is not allowed in production.");

  for (const g of GRADE_LEVELS) {
    await db.insert(schema.gradeLevels).values(g).onConflictDoUpdate({ target: schema.gradeLevels.id, set: g });
  }
  console.log(`✓ ${GRADE_LEVELS.length} grade levels`);

  const subjectIds = new Map<string, string>();
  for (const s of SUBJECTS) {
    const [row] = await db.insert(schema.subjects).values(s).onConflictDoUpdate({ target: schema.subjects.code, set: s }).returning();
    subjectIds.set(s.code, row!.id);
  }
  console.log(`✓ ${SUBJECTS.length} subjects`);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@schoolpawa.example").toLowerCase();
  const [existingAdmin] = await db.select().from(schema.admins).where(eq(schema.admins.email, email));
  if (!existingAdmin) {
    await db.insert(schema.admins).values({
      email,
      name: "Super Admin",
      role: "superadmin",
      passwordHash: await hashSecret(process.env.SEED_ADMIN_PASSWORD ?? "change-me-admin-password"),
      isQualifiedTeacher: false,
    });
    console.log(`✓ admin ${email}`);
  }

  let qCount = 0;
  let tCount = 0;
  for (const [i, t] of TOPICS.entries()) {
    const values = {
      subjectId: subjectIds.get(t.subject)!,
      gradeLevelId: t.grade,
      code: t.code,
      nameSw: t.nameSw,
      nameEn: t.nameEn,
      syllabusRef: t.syllabusRef,
      sortOrder: i,
    };
    const [topic] = await db.insert(schema.topics).values(values).onConflictDoUpdate({ target: schema.topics.code, set: values }).returning();
    const topicId = topic!.id;

    // Lessons are replaced wholesale; questions are matched on prompt so stats survive re-seeding.
    await db.delete(schema.lessons).where(eq(schema.lessons.topicId, topicId));
    if (t.lessons.length) {
      await db.insert(schema.lessons).values(t.lessons.map((l, n) => ({ topicId, sortOrder: n, language: t.language, title: l.title, body: l.body, example: l.example ?? null })));
    }
    const common = { topicId, syllabusRef: t.syllabusRef, language: t.language, sourceType: "original" as const, authorLabel: "School Pawa Content Team", status } as const;
    for (const q of t.questions) {
      const [exists] = await db.select({ id: schema.questions.id }).from(schema.questions).where(and(eq(schema.questions.topicId, topicId), eq(schema.questions.prompt, q.prompt)));
      if (exists) continue;
      await db.insert(schema.questions).values({ ...common, subTopic: q.sub, difficulty: q.d, type: q.type, prompt: q.prompt, options: q.options ?? [], answer: q.answer, explanation: q.explanation });
      qCount++;
    }
    for (const tpl of t.templates) {
      const [exists] = await db
        .select({ id: schema.questionTemplates.id })
        .from(schema.questionTemplates)
        .where(and(eq(schema.questionTemplates.topicId, topicId), sql`${schema.questionTemplates.spec}->>'prompt' = ${tpl.spec.prompt}`));
      if (exists) continue;
      await db.insert(schema.questionTemplates).values({ ...common, subTopic: tpl.sub, difficulty: tpl.d, spec: tpl.spec });
      tCount++;
    }
    const live = await refreshTopicLiveness(topicId);
    console.log(`  ${live ? "●" : "○"} ${t.code}${live ? "" : " (not live — needs review/approval)"}`);
  }
  console.log(`✓ ${TOPICS.length} topics, +${qCount} questions, +${tCount} templates (status: ${status})`);

  const csv = readFileSync(join(process.cwd(), "data/schools/shinyanga.sample.csv"), "utf8");
  const result = await importSchoolsCsv(csv);
  console.log(`✓ schools: ${result.created} created, ${result.updated} updated, ${result.issues.length} issues`);

  if (process.argv.includes("--demo")) {
    if (process.env.NODE_ENV === "production") throw new Error("Demo data is not allowed in production.");
    await seedDemo();
  }
}

main()
  .then(() => pg.end())
  .catch(async (err) => {
    console.error(err);
    await pg.end();
    process.exit(1);
  });
