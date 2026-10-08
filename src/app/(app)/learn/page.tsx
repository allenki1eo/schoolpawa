import { Play, Star } from "lucide-react";
import Link from "next/link";
import { SubjectIcon } from "@/components/app/subject-icon";
import { Stars } from "@/components/game/stars";
import { cn } from "@/lib/client/cn";
import { starsFor } from "@/lib/game/mastery";
import { fmt, pick } from "@/lib/i18n";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { subjectsWithTopics, topicBests } from "@/server/views";

export const metadata = { title: "Jifunze" };

const ROW = 128;
const X = [50, 76, 50, 24]; // zig-zag node positions (% of width)

export default async function LearnPage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const [subjects, bests] = await Promise.all([subjectsWithTopics(student.gradeLevelId), topicBests(student.id)]);
  const totalTopics = subjects.reduce((n, s) => n + s.topics.length, 0);
  const totalStars = subjects.reduce((n, s) => n + s.topics.reduce((m, tp) => m + starsFor(bests.get(tp.id)?.best), 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[1.75rem] leading-tight font-black">{t.map.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.nav.learn}</p>
        </div>
        <span className="num inline-flex items-center gap-1.5 rounded-full bg-gold-400/12 px-3 py-1.5 text-sm font-black text-gold-200 ring-1 ring-gold-400/30">
          <Star className="size-4" fill="currentColor" aria-hidden /> {totalStars}/{totalTopics * 3}
        </span>
      </header>

      {subjects.map(({ subject, topics }) => {
        const nextIndex = topics.findIndex((tp) => starsFor(bests.get(tp.id)?.best) < 3);
        const height = (topics.length - 1) * ROW + 150;
        const points = topics.map((_, i) => `${X[i % X.length]},${i * ROW + 44}`).join(" ");
        return (
          <section key={subject.id} className="surface relative overflow-hidden rounded-3xl p-4" style={{ ["--accent" as string]: subject.accent }}>
            <div aria-hidden className="absolute -top-20 -right-20 size-56 rounded-full blur-3xl" style={{ background: `${subject.accent}22` }} />
            <div className="relative mb-2 flex items-center gap-3">
              <SubjectIcon icon={subject.icon} accent={subject.accent} size={44} />
              <div className="flex-1">
                <h2 className="font-display text-lg font-bold">{pick(subject, "name", locale)}</h2>
                <p className="text-xs text-subtle">{fmt(t.home.topicsCount, { n: topics.length })}</p>
              </div>
            </div>

            <div className="relative" style={{ height }}>
              <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
                <polyline points={points} fill="none" stroke={subject.accent} strokeOpacity="0.35" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {topics.map((topic, i) => {
                const best = bests.get(topic.id)?.best;
                const stars = starsFor(best);
                const isNext = i === nextIndex;
                const mastered = stars === 3;
                return (
                  <Link
                    key={topic.id}
                    href={`/learn/${topic.id}`}
                    className="group absolute flex w-36 -translate-x-1/2 flex-col items-center text-center"
                    style={{ left: `${X[i % X.length]}%`, top: i * ROW }}
                  >
                    <span className="relative">
                      {isNext ? <span aria-hidden className="absolute inset-[-8px] rounded-full motion-safe:animate-glow" style={{ background: `radial-gradient(circle, ${subject.accent}55, transparent 70%)` }} /> : null}
                      <span
                        className={cn(
                          "relative grid size-[5.5rem] place-items-center rounded-full ring-4 transition-transform group-active:scale-95",
                          mastered ? "ring-gold-400 shadow-[var(--shadow-glow-gold)]" : "ring-white/10",
                        )}
                        style={{ background: `radial-gradient(circle at 30% 25%, ${subject.accent}, ${subject.accent}55 60%, #0b1426)` }}
                      >
                        <span className="num font-display text-3xl font-black text-white drop-shadow">{i + 1}</span>
                        {isNext ? (
                          <span className="absolute -bottom-2 inline-flex items-center gap-1 rounded-full bg-fg px-2.5 py-0.5 text-[0.65rem] font-black text-ink-950 shadow">
                            <Play className="size-3" fill="currentColor" aria-hidden /> {t.map.start}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <Stars value={stars} size={14} className={isNext ? "mt-5" : "mt-3"} label={fmt(t.map.stars, { n: stars })} />
                    <span className="mt-0.5 line-clamp-2 text-xs leading-tight font-bold">{pick(topic, "name", locale)}</span>
                    {best ? <span className="num text-[0.6rem] text-subtle">{fmt(t.map.best, { n: best })}</span> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
