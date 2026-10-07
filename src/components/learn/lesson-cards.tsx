"use client";

import { Lightbulb } from "lucide-react";
import { useRef, useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";

interface Lesson {
  id: string;
  title: string;
  body: string;
  example: string | null;
}

/** Swipeable lesson cards using native scroll-snap (no JS gesture library). */
export function LessonCards({ lessons, accent }: { lessons: Lesson[]; accent: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  if (lessons.length === 0) return null;

  const goTo = (i: number) => {
    const el = scroller.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <section aria-label={t.learn.lessonTitle}>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4"
      >
        {lessons.map((l, i) => (
          <article key={l.id} className="surface relative w-[calc(100%-0.5rem)] shrink-0 snap-start overflow-hidden rounded-3xl p-5">
            <span aria-hidden className="absolute -top-16 -right-16 size-40 rounded-full blur-3xl" style={{ background: `${accent}33` }} />
            <p className="num relative text-xs font-bold" style={{ color: accent }}>
              {fmt(t.learn.cardOf, { n: i + 1, total: lessons.length })}
            </p>
            <h2 className="font-display relative mt-1 text-xl font-extrabold">{l.title}</h2>
            <p className="relative mt-3 text-[0.95rem] leading-relaxed text-muted">{l.body}</p>
            {l.example ? (
              <div className="relative mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-line">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-gold-200">
                  <Lightbulb className="size-3.5" aria-hidden /> {t.learn.example}
                </p>
                <p className="text-sm leading-relaxed">{l.example}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {lessons.map((l, i) => (
          <button
            key={l.id}
            type="button"
            aria-label={fmt(t.learn.cardOf, { n: i + 1, total: lessons.length })}
            onClick={() => goTo(i)}
            className={cn("h-2 rounded-full transition-all", i === index ? "w-6" : "w-2 bg-ink-600")}
            style={i === index ? { background: accent } : undefined}
          />
        ))}
      </div>
    </section>
  );
}
