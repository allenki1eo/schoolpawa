import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { Player, type PlayerQuestion } from "@/components/quiz/player";
import { pick } from "@/lib/i18n";
import { ApiError } from "@/server/http";
import { getDict } from "@/server/locale";
import { sessionState } from "@/server/quiz/engine";
import { currentStudent } from "@/server/session";

export const metadata = { title: "Quiz" };

export default async function PlayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) notFound();
  const student = await currentStudent();
  if (!student) redirect("/");
  const { locale } = await getDict();

  let state: Awaited<ReturnType<typeof sessionState>>;
  try {
    state = await sessionState(student, sessionId);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  if (state.status !== "active" || !("question" in state)) redirect(`/play/${sessionId}/review`);

  const [row] = await db
    .select({ topic: schema.topics, subject: schema.subjects })
    .from(schema.quizSessions)
    .innerJoin(schema.topics, eq(schema.topics.id, schema.quizSessions.topicId))
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.topics.subjectId))
    .where(eq(schema.quizSessions.id, sessionId));

  return (
    <Player
      sessionId={sessionId}
      initial={state.question as PlayerQuestion}
      initialElapsed={state.elapsedMs}
      initialScore={state.score}
      accent={row?.subject.accent ?? "#f7c948"}
      title={row ? pick(row.topic, "name", locale) : ""}
    />
  );
}
