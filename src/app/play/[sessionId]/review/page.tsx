import { ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";
import { ApiError } from "@/server/http";
import { getDict } from "@/server/locale";
import { sessionReview } from "@/server/quiz/engine";
import { currentStudent } from "@/server/session";

export const metadata = { title: "Majibu" };

export default async function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const student = await currentStudent();
  if (!student) redirect("/");
  const { t } = await getDict();
  let items: Awaited<ReturnType<typeof sessionReview>>;
  try {
    items = await sessionReview(student, sessionId);
  } catch (e) {
    if (e instanceof ApiError && e.code === "session_active") redirect(`/play/${sessionId}`);
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const correct = items.filter((i) => i.correct).length;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
      <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" aria-hidden /> {t.results.home}
      </Link>
      <h1 className="font-display mt-4 text-3xl font-black">{t.results.review}</h1>
      <p className="num text-muted">{fmt(t.results.correctOf, { correct, total: items.length })}</p>
      <ol className="mt-6 space-y-3">
        {items.map((it) => (
          <li key={it.position} className={cn("surface rounded-3xl p-4", it.correct ? "ring-1 ring-success/25" : "ring-1 ring-danger/25")}>
            <div className="flex items-start gap-3">
              <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", it.correct ? "bg-success text-ink-950" : "bg-danger text-ink-950")}>
                {it.correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <span className="num mr-1 text-subtle">{it.position + 1}.</span>
                  {it.prompt}
                </p>
                <p className="mt-2 text-sm text-success">
                  ✓{" "}
                  {typeof it.correctAnswer === "boolean"
                    ? it.correctAnswer
                      ? t.quiz.trueLabel
                      : t.quiz.falseLabel
                    : Array.isArray(it.correctAnswer)
                      ? it.correctAnswer.map((i) => it.options[i]).join(" → ")
                      : it.type === "mcq"
                        ? it.options[it.correctAnswer]
                        : it.correctAnswer.toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-sm text-muted">{it.explanation}</p>
              </div>
              {it.points > 0 ? <span className="num text-sm font-black text-gold-200">+{it.points}</span> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
