"use client";

import { Check, ChevronRight, Flag, Home, RotateCcw, Sparkles, Trophy, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api, haptic } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import { levelFor } from "@/lib/ranking/levels";
import { QUESTION_FLAG_REASONS } from "@/lib/safety/presets";
import type { SubmittedAnswer } from "@/lib/quiz/types";
import { CountdownRing } from "./countdown";
import { ScoreCountUp } from "./count-up";

export interface PlayerQuestion {
  position: number;
  total: number;
  type: "mcq" | "true_false" | "number" | "ordering";
  prompt: string;
  options: string[];
  unit?: string;
  difficulty: 1 | 2 | 3;
  limitMs: number;
}

interface Feedback {
  correct: boolean;
  timedOut: boolean;
  correctAnswer: number | number[] | boolean;
  explanation: string;
  points: number;
  questionRef: string | null;
}

interface Summary {
  score: number;
  correct: number;
  total: number;
  held: boolean;
  streak: number;
  xp: number;
  leveledUp: boolean;
  challengeId: string | null;
}

type Phase = "question" | "submitting" | "feedback" | "loading" | "summary";

const LETTERS = ["A", "B", "C", "D", "E"];

export function Player({
  sessionId,
  initial,
  initialElapsed,
  initialScore,
  accent,
  title,
}: {
  sessionId: string;
  initial: PlayerQuestion;
  initialElapsed: number;
  initialScore: number;
  accent: string;
  title: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [phase, setPhase] = useState<Phase>("question");
  const [score, setScore] = useState(initialScore);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hasNext, setHasNext] = useState(true);
  const [picked, setPicked] = useState<number | boolean | null>(null);
  const [numberValue, setNumberValue] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [deadline, setDeadline] = useState(() => Date.now() + initial.limitMs - initialElapsed);
  const [flagOpen, setFlagOpen] = useState(false);
  const [streakRun, setStreakRun] = useState(0);
  const submittedRef = useRef(false);

  const resetInputs = () => {
    setPicked(null);
    setNumberValue("");
    setOrder([]);
    submittedRef.current = false;
  };

  const submit = useCallback(
    async (answer: SubmittedAnswer) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setPhase("submitting");
      // Retries are safe: the server replays the recorded result for the same position.
      let r = await api<{ feedback: Feedback; score: number; hasNext: boolean; summary?: Summary }>(`/api/quiz/${sessionId}/answer`, {
        body: { position: q.position, answer },
      });
      for (let attempt = 0; !r.ok && r.error === "network" && attempt < 3; attempt++) {
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        r = await api(`/api/quiz/${sessionId}/answer`, { body: { position: q.position, answer } });
      }
      if (!r.ok) {
        toast(errorMessage(t, r.error), "error");
        if (r.error === "session_closed") router.replace("/home");
        submittedRef.current = false;
        setPhase("question");
        return;
      }
      setFeedback(r.data.feedback);
      setScore(r.data.score);
      setHasNext(r.data.hasNext);
      if (r.data.summary) setSummary(r.data.summary);
      setStreakRun((s) => (r.ok && r.data.feedback.correct ? s + 1 : 0));
      haptic(r.data.feedback.correct ? [15] : [40, 60, 40]);
      setPhase("feedback");
    },
    [q.position, sessionId, t, toast, router],
  );

  const next = async () => {
    if (!hasNext) {
      setPhase("summary");
      return;
    }
    setPhase("loading");
    const r = await api<{ question: PlayerQuestion; elapsedMs: number; score: number }>(`/api/quiz/${sessionId}`);
    if (!r.ok || !r.data.question) {
      toast(errorMessage(t, r.ok ? "generic" : r.error), "error");
      setPhase("feedback");
      return;
    }
    resetInputs();
    setFeedback(null);
    setQ(r.data.question);
    setDeadline(Date.now() + r.data.question.limitMs - r.data.elapsedMs);
    setPhase("question");
  };

  const onTimeout = useCallback(() => {
    if (phase === "question") void submit({ type: "timeout" });
  }, [phase, submit]);

  if (phase === "summary" && summary) return <SummaryScreen summary={summary} sessionId={sessionId} accent={accent} />;

  const answered = phase === "feedback" || phase === "loading";
  const progress = (q.position + (answered ? 1 : 0)) / q.total;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-3 pb-6" style={{ ["--accent" as string]: accent }}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link href="/home" aria-label={t.results.home} className="grid size-10 place-items-center rounded-full bg-white/5 ring-1 ring-line" onClick={(e) => { if (!confirm(t.quiz.leaveConfirm)) e.preventDefault(); }}>
          <X className="size-5" aria-hidden />
        </Link>
        <div className="flex flex-1 gap-1" aria-label={fmt(t.quiz.question, { n: q.position + 1, total: q.total })}>
          {Array.from({ length: q.total }, (_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i < q.position + (answered ? 1 : 0) ? "bg-[var(--accent)]" : i === q.position ? "bg-white/30" : "bg-white/10")}
            />
          ))}
        </div>
        <span className="num inline-flex items-center gap-1 rounded-full bg-gold-400/12 px-3 py-1.5 text-sm font-black text-gold-200 ring-1 ring-gold-400/25">
          <Zap className="size-3.5" fill="currentColor" aria-hidden />
          {score}
        </span>
      </header>
      <span className="sr-only" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} />

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-bold tracking-wide text-subtle uppercase">
          {title} · <span className="num">{fmt(t.quiz.question, { n: q.position + 1, total: q.total })}</span>
        </p>
        <CountdownRing deadline={deadline} limitMs={q.limitMs} running={phase === "question"} onExpire={onTimeout} label={t.quiz.timeLeft} />
      </div>

      {streakRun >= 3 && phase !== "question" ? (
        <p className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-300 motion-safe:animate-pop">
          🔥 ×{streakRun}
        </p>
      ) : null}

      {/* Question */}
      <section key={q.position} className="mt-4 flex flex-1 flex-col motion-safe:animate-rise">
        <h1 className="font-display text-[1.45rem] leading-snug font-bold text-balance">{q.prompt}</h1>
        {q.unit && q.type === "number" ? <p className="mt-1 text-sm text-subtle">({q.unit})</p> : null}

        <div className="mt-6 flex-1">
          {q.type === "mcq" && (
            <div className="grid gap-3">
              {q.options.map((opt, i) => {
                const isCorrect = answered && feedback?.correctAnswer === i;
                const isWrongPick = answered && picked === i && !isCorrect;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={phase !== "question"}
                    onClick={() => {
                      setPicked(i);
                      void submit({ type: "mcq", displayIndex: i });
                    }}
                    className={cn(
                      "group flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left text-[1.02rem] font-semibold ring-1 transition-all duration-200",
                      !answered && "bg-ink-850 ring-line-strong active:scale-[0.98] enabled:hover:bg-ink-800",
                      phase === "submitting" && picked === i && "ring-2 ring-[var(--accent)]",
                      isCorrect && "bg-success/15 text-fg ring-2 ring-success motion-safe:animate-pop",
                      isWrongPick && "bg-danger/15 ring-2 ring-danger motion-safe:animate-shake",
                      answered && !isCorrect && !isWrongPick && "bg-ink-900 opacity-55 ring-line",
                    )}
                  >
                    <span
                      className={cn(
                        "num grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black",
                        isCorrect ? "bg-success text-ink-950" : isWrongPick ? "bg-danger text-ink-950" : "bg-white/8 text-muted",
                      )}
                    >
                      {isCorrect ? <Check className="size-5" aria-hidden /> : isWrongPick ? <X className="size-5" aria-hidden /> : LETTERS[i]}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "true_false" && (
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => {
                const isCorrect = answered && feedback?.correctAnswer === v;
                const isWrongPick = answered && picked === v && !isCorrect;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={phase !== "question"}
                    onClick={() => {
                      setPicked(v);
                      void submit({ type: "true_false", value: v });
                    }}
                    className={cn(
                      "flex h-32 flex-col items-center justify-center gap-2 rounded-3xl text-lg font-bold ring-1 transition-all",
                      !answered && "bg-ink-850 ring-line-strong active:scale-95",
                      isCorrect && "bg-success/15 ring-2 ring-success motion-safe:animate-pop",
                      isWrongPick && "bg-danger/15 ring-2 ring-danger motion-safe:animate-shake",
                      answered && !isCorrect && !isWrongPick && "opacity-50 ring-line",
                    )}
                  >
                    <span className={cn("grid size-12 place-items-center rounded-full", v ? "bg-success/20 text-success" : "bg-danger/20 text-danger")}>
                      {v ? <Check className="size-7" aria-hidden /> : <X className="size-7" aria-hidden />}
                    </span>
                    {v ? t.quiz.trueLabel : t.quiz.falseLabel}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "number" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = Number(numberValue.replace(/,/g, "").replace(/\s/g, ""));
                if (numberValue.trim() === "" || !Number.isFinite(value)) return;
                void submit({ type: "number", value });
              }}
              className="space-y-3"
            >
              <div className="relative">
                <input
                  value={numberValue}
                  onChange={(e) => setNumberValue(e.target.value.replace(/[^\d.,\-\s]/g, ""))}
                  inputMode="decimal"
                  autoFocus
                  disabled={phase !== "question"}
                  placeholder={t.quiz.numberPlaceholder}
                  aria-label={t.quiz.numberPlaceholder}
                  className={cn(
                    "num h-20 w-full rounded-3xl bg-ink-850 px-5 text-center font-display text-3xl font-black ring-1 ring-line-strong focus:ring-2 focus:ring-[var(--accent)] focus:outline-none",
                    answered && (feedback?.correct ? "ring-2 ring-success" : "ring-2 ring-danger motion-safe:animate-shake"),
                  )}
                />
                {q.unit ? <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-sm font-semibold text-subtle">{q.unit}</span> : null}
              </div>
              {!answered ? (
                <Button type="submit" variant="accent" size="lg" block loading={phase === "submitting"} disabled={numberValue.trim() === ""}>
                  {t.quiz.submit}
                </Button>
              ) : null}
            </form>
          )}

          {q.type === "ordering" && (
            <OrderingInput
              options={q.options}
              order={order}
              setOrder={setOrder}
              disabled={phase !== "question"}
              correct={answered ? (feedback?.correctAnswer as number[]) : null}
              onSubmit={() => void submit({ type: "ordering", displayOrder: order })}
              busy={phase === "submitting"}
            />
          )}
        </div>

        {/* Feedback */}
        {answered && feedback ? (
          <div
            role="status"
            className={cn(
              "mt-5 rounded-3xl p-4 ring-1 motion-safe:animate-rise",
              feedback.correct ? "bg-success/10 ring-success/30" : "bg-danger/10 ring-danger/30",
            )}
          >
            <div className="flex items-center justify-between">
              <p className={cn("flex items-center gap-2 font-display text-lg font-extrabold", feedback.correct ? "text-success" : "text-red-300")}>
                {feedback.correct ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
                {feedback.correct ? t.quiz.correct : feedback.timedOut ? t.quiz.timeout : t.quiz.wrong}
              </p>
              {feedback.points > 0 ? <span className="num font-display text-xl font-black text-gold-200 motion-safe:animate-pop">+{feedback.points}</span> : null}
            </div>
            {!feedback.correct ? <p className="mt-1 text-sm font-semibold">{fmt(t.quiz.correctAnswer, { answer: describeAnswer(q, feedback.correctAnswer, t) })}</p> : null}
            <p className="mt-2 text-sm leading-relaxed text-muted">{feedback.explanation}</p>
            {feedback.questionRef ? (
              <button type="button" onClick={() => setFlagOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-subtle hover:text-muted">
                <Flag className="size-3.5" aria-hidden /> {t.quiz.flag}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {answered ? (
        <div className="sticky bottom-4 mt-5">
          <Button variant={hasNext ? "primary" : "gold"} size="lg" block loading={phase === "loading"} onClick={next} autoFocus>
            {hasNext ? t.quiz.next : t.quiz.finish} <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
      ) : null}

      <Sheet open={flagOpen} onClose={() => setFlagOpen(false)} title={t.quiz.flag}>
        <div className="grid gap-2">
          {QUESTION_FLAG_REASONS.map((reason) => (
            <Button
              key={reason}
              block
              onClick={async () => {
                setFlagOpen(false);
                const r = await api("/api/report", { body: { targetType: "question", targetId: feedback?.questionRef, reason } });
                toast(r.ok ? t.quiz.flagThanks : errorMessage(t, r.error), r.ok ? "success" : "error");
              }}
            >
              {t.flagReasons[reason]}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function describeAnswer(q: PlayerQuestion, answer: number | number[] | boolean, t: ReturnType<typeof useI18n>["t"]): string {
  if (typeof answer === "boolean") return answer ? t.quiz.trueLabel : t.quiz.falseLabel;
  if (Array.isArray(answer)) return answer.map((i) => q.options[i]).join(" → ");
  if (q.type === "mcq") return `${LETTERS[answer]}. ${q.options[answer]}`;
  return `${answer.toLocaleString("en-US", { maximumFractionDigits: 6 })}${q.unit ? ` ${q.unit}` : ""}`;
}

function OrderingInput({
  options,
  order,
  setOrder,
  disabled,
  correct,
  onSubmit,
  busy,
}: {
  options: string[];
  order: number[];
  setOrder: (o: number[]) => void;
  disabled: boolean;
  correct: number[] | null;
  onSubmit: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <p className="text-sm text-subtle">{t.quiz.orderingHint}</p>
      <div className="grid gap-2.5">
        {options.map((opt, i) => {
          const pos = order.indexOf(i);
          const rightPos = correct ? correct.indexOf(i) : -1;
          const ok = correct ? pos === rightPos : null;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || pos >= 0}
              onClick={() => {
                haptic(6);
                setOrder([...order, i]);
              }}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold ring-1 transition-all",
                pos >= 0 ? "bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] ring-[var(--accent)]" : "bg-ink-850 ring-line-strong active:scale-[0.98]",
                ok === true && "bg-success/15 ring-2 ring-success",
                ok === false && "bg-danger/15 ring-2 ring-danger",
              )}
            >
              <span className={cn("num grid size-8 shrink-0 place-items-center rounded-full text-sm font-black", pos >= 0 ? "bg-[var(--accent)] text-ink-950" : "bg-white/8 text-subtle")}>
                {pos >= 0 ? pos + 1 : "·"}
              </span>
              <span className="flex-1">{opt}</span>
              {correct ? <span className="num text-xs font-bold text-subtle">→ {rightPos + 1}</span> : null}
            </button>
          );
        })}
      </div>
      {!correct ? (
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <Button type="button" variant="ghost" onClick={() => setOrder([])} disabled={disabled || order.length === 0} aria-label={t.quiz.reset}>
            <RotateCcw className="size-4" aria-hidden />
          </Button>
          <Button type="button" variant="accent" size="lg" onClick={onSubmit} disabled={disabled || order.length !== options.length} loading={busy}>
            {t.quiz.submit}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SummaryScreen({ summary, sessionId, accent }: { summary: Summary; sessionId: string; accent: string }) {
  const { t } = useI18n();
  const ratio = summary.correct / Math.max(1, summary.total);
  const headline = ratio === 1 ? t.results.perfect : ratio >= 0.7 ? t.results.great : ratio >= 0.4 ? t.results.good : t.results.keepGoing;
  const level = useMemo(() => levelFor(summary.xp), [summary.xp]);
  useEffect(() => {
    haptic(ratio >= 0.7 ? [20, 50, 20, 50, 40] : [20]);
  }, [ratio]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center px-5 pt-10 pb-8 text-center" style={{ ["--accent" as string]: accent }}>
      <div className="relative">
        {ratio >= 0.7 ? <span aria-hidden className="absolute inset-0 rounded-full bg-gold-400/40 motion-safe:animate-burst" /> : null}
        <span className="relative grid size-28 place-items-center rounded-full bg-gradient-to-b from-gold-200/25 to-gold-500/5 ring-2 ring-gold-400/50 shadow-[var(--shadow-glow-gold)]">
          <Trophy className="size-14 text-gold-400" aria-hidden />
        </span>
      </div>
      <h1 className="font-display mt-6 text-3xl font-black">{headline}</h1>
      <p className="num mt-1 text-muted">{fmt(t.results.correctOf, { correct: summary.correct, total: summary.total })}</p>

      <div className="mt-8">
        <ScoreCountUp value={summary.score} className="font-display text-7xl font-black text-gold-gradient" />
        <p className="mt-1 text-sm font-semibold text-gold-200">{fmt(t.results.pointsEarned, { n: summary.score })}</p>
      </div>

      <div className="mt-8 grid w-full gap-3 text-left">
        {summary.held ? <Notice tone="info">{t.results.held}</Notice> : null}
        {summary.leveledUp ? (
          <Notice tone="gold">
            <Sparkles className="size-4" aria-hidden /> {fmt(t.results.levelUp, { level: t.levels[level.key] })}
          </Notice>
        ) : null}
        <Notice tone="flame">{fmt(t.results.streak, { n: summary.streak })}</Notice>
        {summary.challengeId ? <Notice tone="info">{t.results.challengeSent}</Notice> : null}
      </div>

      <div className="mt-auto grid w-full gap-3 pt-10">
        <Link href={`/play/${sessionId}/review`} className="flex h-14 items-center justify-center rounded-2xl bg-ink-800 font-semibold ring-1 ring-line-strong">
          {t.results.review}
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href={summary.challengeId ? "/challenges" : "/learn"} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold-200 via-gold-400 to-gold-500 font-semibold text-ink-950">
            <RotateCcw className="size-4" aria-hidden /> {summary.challengeId ? t.challenges.title : t.results.playAgain}
          </Link>
          <Link href="/home" className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-fg font-semibold text-ink-950">
            <Home className="size-4" aria-hidden /> {t.results.home}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "gold" | "flame"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 motion-safe:animate-rise",
        tone === "info" && "bg-info/10 text-info ring-info/25",
        tone === "gold" && "bg-gold-400/12 text-gold-200 ring-gold-400/30",
        tone === "flame" && "bg-orange-500/10 text-orange-200 ring-orange-400/25",
      )}
    >
      {children}
    </p>
  );
}
