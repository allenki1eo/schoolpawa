"use client";

import { ArrowLeft, Check, ChevronRight, CloudOff, CloudUpload, PackageOpen, Play, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { Button } from "@/components/ui/button";
import { api, haptic } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";
import { idb, idbAvailable } from "@/lib/offline/db";
import { flushQueue } from "@/lib/offline/sync";
import type { PackQuestion, QueuedResult, StoredPack } from "@/lib/offline/types";
import type { SubmittedAnswer } from "@/lib/quiz/types";

/**
 * Offline play. Grading happens locally for instant feedback; the server re-grades on sync
 * (see server/offline.ts). Starter packs (pre-consent) are never queued or uploaded.
 */
export function OfflineView() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [packs, setPacks] = useState<StoredPack[]>([]);
  const [queued, setQueued] = useState(0);
  const [playing, setPlaying] = useState<StoredPack | null>(null);

  const refresh = useCallback(async () => {
    if (!idbAvailable()) return;
    setPacks((await idb.all<StoredPack>("packs")).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
    setQueued((await idb.all<QueuedResult>("queue")).length);
  }, []);

  useEffect(() => {
    void refresh();
    const onSynced = () => void refresh();
    window.addEventListener("schoolpawa:synced", onSynced);
    return () => window.removeEventListener("schoolpawa:synced", onSynced);
  }, [refresh]);

  // Starter practice for profiles awaiting consent: anonymous download, local only.
  useEffect(() => {
    const grade = params.get("starter");
    if (!grade || !idbAvailable()) return;
    void (async () => {
      const key = `starter:${grade}`;
      if (!(await idb.get<StoredPack>("packs", key))) {
        const r = await api<{ topicId: string; issuedAt: string; questions: PackQuestion[] }>(`/api/packs/starter?grade=${encodeURIComponent(grade)}`);
        if (r.ok) {
          await idb.put<StoredPack>("packs", { key, packId: null, studentId: null, topicId: r.data.topicId, topicName: t.offline.starter, accent: "#f7c948", issuedAt: r.data.issuedAt, questions: r.data.questions });
        }
      }
      await refresh();
    })();
  }, [params, refresh, t.offline.starter]);

  if (playing) {
    return (
      <PackPlayer
        pack={playing}
        onDone={async () => {
          setPlaying(null);
          await refresh();
          void flushQueue().then(refresh);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" aria-hidden /> {t.common.back}
      </Link>
      <h1 className="font-display mt-4 flex items-center gap-2 text-3xl font-black">
        <CloudOff className="size-7 text-gold-400" aria-hidden /> {t.offline.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{t.offline.sub}</p>

      {queued > 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-info/10 px-4 py-3 text-sm text-info ring-1 ring-info/25">
          <CloudUpload className="size-4" aria-hidden /> {fmt(t.profile.queued, { n: queued })}
        </p>
      ) : null}

      {packs.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted">
          <PackageOpen className="size-10 text-subtle" aria-hidden />
          <p className="max-w-xs text-sm">{t.offline.noPacks}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {packs.map((p) => (
            <li key={p.key} className="surface flex items-center gap-3 rounded-3xl p-4" style={{ ["--accent" as string]: p.accent }}>
              <span aria-hidden className="h-12 w-1.5 rounded-full" style={{ background: p.accent }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.topicName}</p>
                <p className="text-xs text-subtle">
                  {p.packId ? `${p.questions.length} Q` : t.offline.starterSub}
                  {p.played ? (
                    <>
                      {" · "}
                      <span className="num">{p.played.correct}/{p.played.total}</span>
                      {" · "}
                      {p.played.synced != null ? <span className="text-success">{fmt(t.offline.synced, { n: p.played.synced })}</span> : p.packId ? t.offline.syncPending : null}
                    </>
                  ) : null}
                </p>
              </div>
              <Button size="sm" variant={p.played ? "secondary" : "gold"} onClick={() => setPlaying(p)}>
                <Play className="size-4" fill="currentColor" aria-hidden /> {t.offline.play}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function gradeLocal(q: PackQuestion, a: SubmittedAnswer): boolean {
  const ans = q.answer;
  if (a.type === "timeout") return false;
  if (ans.type === "mcq") return a.type === "mcq" && a.displayIndex === ans.correctIndex;
  if (ans.type === "true_false") return a.type === "true_false" && a.value === ans.value;
  if (ans.type === "number") return a.type === "number" && Math.abs(a.value - ans.value) <= (ans.tolerance ?? 1e-9);
  return a.type === "ordering" && a.displayOrder.join() === ans.order.join();
}

function PackPlayer({ pack, onDone }: { pack: StoredPack; onDone: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Array<{ index: number; answer: SubmittedAnswer; correct: boolean }>>([]);
  const [current, setCurrent] = useState<{ correct: boolean } | null>(null);
  const [num, setNum] = useState("");
  const [order, setOrder] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const q = pack.questions[i]!;
  const display = useMemo(() => (q.type === "mcq" || q.type === "ordering" ? shuffled(q.options.length) : []), [q]);

  const answer = (a: SubmittedAnswer) => {
    if (current) return;
    const correct = gradeLocal(q, a);
    haptic(correct ? 15 : [40, 60, 40]);
    setCurrent({ correct });
    setAnswers((prev) => [...prev, { index: q.index, answer: a, correct }]);
  };

  const next = async () => {
    setCurrent(null);
    setNum("");
    setOrder([]);
    if (i + 1 < pack.questions.length) return setI(i + 1);
    const correct = answers.filter((a) => a.correct).length;
    await idb.put<StoredPack>("packs", { ...pack, played: { at: new Date().toISOString(), correct, total: answers.length, synced: null } });
    if (pack.packId && pack.studentId && !pack.played) {
      await idb.put<QueuedResult>("queue", {
        clientResultId: crypto.randomUUID(),
        packId: pack.packId,
        studentId: pack.studentId,
        answers: answers.map(({ index, answer }) => ({ index, answer })),
        createdAt: new Date().toISOString(),
      });
    }
    setFinished(true);
  };

  if (finished) {
    const correct = answers.filter((a) => a.correct).length;
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-3xl font-black">{t.offline.finished}</p>
        <p className="num font-display mt-4 text-6xl font-black text-gold-gradient">{correct}/{answers.length}</p>
        <Button variant="gold" size="lg" block className="mt-10" onClick={onDone}>{t.common.done}</Button>
      </div>
    );
  }

  const correctAnswerText =
    q.answer.type === "mcq" ? q.options[q.answer.correctIndex] : q.answer.type === "true_false" ? (q.answer.value ? t.quiz.trueLabel : t.quiz.falseLabel) : q.answer.type === "number" ? `${q.answer.value.toLocaleString("en-US")}${q.unit ? ` ${q.unit}` : ""}` : q.answer.order.map((k) => q.options[k]).join(" → ");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-4 pb-6" style={{ ["--accent" as string]: pack.accent }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} aria-label={t.common.close} className="grid size-10 place-items-center rounded-full bg-white/5 ring-1 ring-line"><X className="size-5" aria-hidden /></button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${((i + (current ? 1 : 0)) / pack.questions.length) * 100}%` }} /></div>
        <span className="num text-xs font-bold text-subtle">{i + 1}/{pack.questions.length}</span>
      </div>
      <h1 key={i} className="font-display mt-8 text-[1.4rem] leading-snug font-bold motion-safe:animate-rise">{q.prompt}</h1>
      <div className="mt-6 flex-1 space-y-3">
        {q.type === "mcq" &&
          display.map((canon) => (
            <button key={canon} type="button" disabled={Boolean(current)} onClick={() => answer({ type: "mcq", displayIndex: canon })} className={cn("flex min-h-14 w-full items-center rounded-2xl px-4 text-left font-semibold ring-1", current && q.answer.type === "mcq" && canon === q.answer.correctIndex ? "bg-success/15 ring-2 ring-success" : "bg-ink-850 ring-line-strong")}>
              {q.options[canon]}
            </button>
          ))}
        {q.type === "true_false" && (
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" disabled={Boolean(current)} onClick={() => answer({ type: "true_false", value: v })} className="h-24 rounded-3xl bg-ink-850 text-lg font-bold ring-1 ring-line-strong">
                {v ? t.quiz.trueLabel : t.quiz.falseLabel}
              </button>
            ))}
          </div>
        )}
        {q.type === "number" && (
          <form onSubmit={(e) => { e.preventDefault(); const v = Number(num.replace(/,/g, "")); if (num && Number.isFinite(v)) answer({ type: "number", value: v }); }} className="space-y-3">
            <input value={num} onChange={(e) => setNum(e.target.value)} inputMode="decimal" disabled={Boolean(current)} aria-label={t.quiz.numberPlaceholder} placeholder={t.quiz.numberPlaceholder} className="num h-16 w-full rounded-2xl bg-ink-850 px-4 text-center text-2xl font-black ring-1 ring-line-strong" />
            {!current ? <Button type="submit" variant="accent" size="lg" block>{t.quiz.submit}</Button> : null}
          </form>
        )}
        {q.type === "ordering" && (
          <>
            {display.map((canon) => {
              const pos = order.indexOf(canon);
              return (
                <button key={canon} type="button" disabled={Boolean(current) || pos >= 0} onClick={() => setOrder([...order, canon])} className={cn("flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-semibold ring-1", pos >= 0 ? "ring-[var(--accent)]" : "bg-ink-850 ring-line-strong")}>
                  <span className="num grid size-7 place-items-center rounded-full bg-white/10 text-xs">{pos >= 0 ? pos + 1 : "·"}</span>
                  {q.options[canon]}
                </button>
              );
            })}
            {!current ? (
              <Button variant="accent" size="lg" block disabled={order.length !== q.options.length} onClick={() => answer({ type: "ordering", displayOrder: order })}>{t.quiz.submit}</Button>
            ) : null}
          </>
        )}
        {current ? (
          <div role="status" className={cn("rounded-3xl p-4 ring-1", current.correct ? "bg-success/10 ring-success/30" : "bg-danger/10 ring-danger/30")}>
            <p className={cn("flex items-center gap-2 font-bold", current.correct ? "text-success" : "text-red-300")}>
              {current.correct ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
              {current.correct ? t.quiz.correct : t.quiz.wrong}
            </p>
            {!current.correct ? <p className="mt-1 text-sm font-semibold">{fmt(t.quiz.correctAnswer, { answer: correctAnswerText ?? "" })}</p> : null}
            <p className="mt-2 text-sm text-muted">{q.explanation}</p>
          </div>
        ) : null}
      </div>
      {current ? (
        <Button variant="primary" size="lg" block onClick={next}>
          {t.quiz.next} <ChevronRight className="size-5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
