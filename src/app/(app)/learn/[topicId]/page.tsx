import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Play, Swords } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { SubjectIcon } from "@/components/app/subject-icon";
import { DownloadPackButton } from "@/components/learn/download-pack";
import { LessonCards } from "@/components/learn/lesson-cards";
import { StartQuizButton } from "@/components/quiz/start-button";
import { pick } from "@/lib/i18n";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(topicId)) notFound();
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const [row] = await db
    .select({ topic: schema.topics, subject: schema.subjects })
    .from(schema.topics)
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.topics.subjectId))
    .where(eq(schema.topics.id, topicId));
  if (!row || row.topic.gradeLevelId !== student.gradeLevelId || !row.topic.isLive) notFound();
  const lessons = await db.select().from(schema.lessons).where(eq(schema.lessons.topicId, topicId)).orderBy(asc(schema.lessons.sortOrder));
  const { topic, subject } = row;
  const topicName = pick(topic, "name", locale);

  return (
    <div className="space-y-6" style={{ ["--accent" as string]: subject.accent }}>
      <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" aria-hidden /> {t.nav.learn}
      </Link>
      <header className="flex items-center gap-4">
        <SubjectIcon icon={subject.icon} accent={subject.accent} size={56} />
        <div>
          <p className="text-xs font-bold tracking-wide uppercase" style={{ color: subject.accent }}>{pick(subject, "name", locale)}</p>
          <h1 className="font-display text-2xl leading-tight font-black">{topicName}</h1>
          <p className="text-xs text-subtle">{topic.syllabusRef}</p>
        </div>
      </header>

      <LessonCards lessons={lessons.map((l) => ({ id: l.id, title: l.title, body: l.body, example: l.example }))} accent={subject.accent} />

      <div className="space-y-3">
        <StartQuizButton topicId={topic.id} variant="gold" size="lg" block>
          <Play className="size-5" fill="currentColor" aria-hidden /> {t.learn.startQuiz}
        </StartQuizButton>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/challenges?new=1&topic=${topic.id}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-800 text-sm font-semibold ring-1 ring-line-strong">
            <Swords className="size-4" aria-hidden /> {t.learn.challenge}
          </Link>
          <DownloadPackButton topicId={topic.id} topicName={topicName} accent={subject.accent} studentId={student.id} />
        </div>
      </div>
    </div>
  );
}
