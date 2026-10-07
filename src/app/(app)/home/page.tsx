import { ArrowRight, CalendarCheck2, ChevronRight, Hourglass, Swords, Zap } from "lucide-react";
import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { Avatar } from "@/components/brand/avatar";
import { Crest } from "@/components/brand/crest";
import { SubjectIcon } from "@/components/app/subject-icon";
import { StartQuizButton } from "@/components/quiz/start-button";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fmt, pick } from "@/lib/i18n";
import { levelFor } from "@/lib/ranking/levels";
import { schoolBoard } from "@/server/leaderboard";
import { pendingPoints } from "@/server/ledger";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { dailyStatus, studentContext, subjectsWithTopics } from "@/server/views";

export const metadata = { title: "Nyumbani" };

export default async function HomePage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const ctx = await studentContext(student);
  const [daily, subjects, pending, board, waiting] = await Promise.all([
    dailyStatus(student),
    subjectsWithTopics(student.gradeLevelId),
    pendingPoints(student.id),
    schoolBoard({ stage: ctx.stage, period: "weekly" }),
    db
      .select({ n: count() })
      .from(schema.challenges)
      .where(and(eq(schema.challenges.opponentId, student.id), eq(schema.challenges.status, "open"), isNull(schema.challenges.opponentSessionId))),
  ]);
  const level = levelFor(student.xp);
  const mySchool = board.rows.find((r) => r.schoolId === student.schoolId);
  const waitingCount = waiting[0]?.n ?? 0;

  return (
    <div className="space-y-6">
      {/* Greeting + level */}
      <section className="flex items-center gap-4 motion-safe:animate-rise">
        <Avatar avatar={student.avatar} size={60} ring />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{locale === "sw" ? ctx.gradeSw : ctx.gradeEn} · {ctx.schoolName}</p>
          <h1 className="font-display truncate text-2xl font-extrabold">{fmt(t.home.greeting, { name: student.nickname })}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="gold">{t.levels[level.key]}</Badge>
            <Progress value={level.progress} className="h-2 flex-1" label={t.home.level} />
          </div>
          <p className="mt-1 text-xs text-subtle">{level.next ? fmt(t.home.toNext, { n: level.xpToNext.toLocaleString("en-US"), level: t.levels[level.next] }) : t.home.maxLevel}</p>
        </div>
      </section>

      {pending > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-info/10 px-4 py-3 text-sm text-info ring-1 ring-info/25">
          <Hourglass className="size-4" aria-hidden /> {fmt(t.home.pending, { n: pending })}
        </p>
      ) : null}

      {waitingCount > 0 ? (
        <Link href="/challenges" className="flex items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-red-200 ring-1 ring-danger/30">
          <Swords className="size-5" aria-hidden />
          <span className="flex-1">{fmt(t.home.challengesWaiting, { n: waitingCount })}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      {/* Daily challenge */}
      {daily ? (
        <section
          className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-gold-400/30 motion-safe:animate-rise"
          style={{ background: `radial-gradient(120% 140% at 100% 0%, ${daily.subject.accent}30, transparent 55%), linear-gradient(160deg, #1a2440, #0b1326)` }}
        >
          <div aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full bg-gold-400/15 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <Badge tone="gold">
              <CalendarCheck2 className="size-3.5" aria-hidden /> {t.home.dailyTitle}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-gold-200">
              <Zap className="size-3.5" fill="currentColor" aria-hidden /> {t.home.dailyBonus}
            </span>
          </div>
          <div className="relative mt-4 flex items-center gap-4">
            <SubjectIcon icon={daily.subject.icon} accent={daily.subject.accent} size={56} />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: daily.subject.accent }}>
                {pick(daily.subject, "name", locale)}
              </p>
              <h2 className="font-display text-xl leading-tight font-extrabold">{pick(daily.topic, "name", locale)}</h2>
            </div>
          </div>
          <p className="relative mt-3 text-sm text-muted">{t.home.dailySub}</p>
          <div className="relative mt-5">
            {daily.played?.status === "completed" ? (
              <p className="num rounded-2xl bg-success/10 px-4 py-3 text-center text-sm font-bold text-success ring-1 ring-success/25">
                ✓ {fmt(t.home.dailyDone, { score: daily.played.score })}
              </p>
            ) : daily.played ? (
              <Link href={`/play/${daily.played.id}`} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-gold-200 via-gold-400 to-gold-500 font-semibold text-ink-950">
                {t.challenges.play} <ArrowRight className="size-5" aria-hidden />
              </Link>
            ) : (
              <StartQuizButton topicId={daily.topic.id} kind="daily" variant="gold" size="lg" block>
                {t.home.dailyPlay} <ArrowRight className="size-5" aria-hidden />
              </StartQuizButton>
            )}
          </div>
        </section>
      ) : null}

      {/* School card */}
      <Link href="/rankings?tab=schools" className="block">
        <Card className="flex items-center gap-4 transition-transform active:scale-[0.99]">
          <Crest name={ctx.schoolName} regNo={ctx.regNo} color={ctx.regionColor} size={52} glow={mySchool?.rank === 1} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-subtle uppercase">{t.home.schoolCard}</p>
            <p className="truncate font-bold">{ctx.schoolName}</p>
            <p className="text-sm text-muted">
              {mySchool ? (
                <>
                  <span className="num font-bold text-gold-200">{fmt(t.home.schoolRank, { rank: mySchool.rank })}</span> · {t.rankings.schoolPower}{" "}
                  <span className="num font-semibold text-fg">{mySchool.power.toFixed(1)}</span>
                </>
              ) : (
                t.rankings.unranked
              )}
            </p>
          </div>
          <ChevronRight className="size-5 text-subtle" aria-hidden />
        </Card>
      </Link>

      {/* Subjects */}
      <section>
        <SectionTitle action={<Link href="/learn" className="text-sm font-semibold text-gold-200">{t.common.seeAll}</Link>}>{t.home.subjects}</SectionTitle>
        <div className="grid gap-3">
          {subjects.map(({ subject, topics }) => (
            <Card key={subject.id} className="p-4" style={{ ["--accent" as string]: subject.accent }}>
              <div className="flex items-center gap-3">
                <SubjectIcon icon={subject.icon} accent={subject.accent} />
                <div className="flex-1">
                  <p className="font-bold">{pick(subject, "name", locale)}</p>
                  <p className="text-xs text-subtle">{fmt(t.home.topicsCount, { n: topics.length })}</p>
                </div>
              </div>
              <ul className="mt-3 grid gap-2">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <Link href={`/learn/${topic.id}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-white/[0.06]">
                      {pick(topic, "name", locale)}
                      <ChevronRight className="size-4 text-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <Link href="/challenges?new=1" className="surface flex items-center gap-3 rounded-3xl p-4">
        <span className="grid size-11 place-items-center rounded-2xl bg-danger/15 text-red-300 ring-1 ring-danger/30">
          <Swords className="size-5" aria-hidden />
        </span>
        <span className="flex-1 font-bold">{t.home.challengeFriend}</span>
        <ChevronRight className="size-5 text-subtle" aria-hidden />
      </Link>

      <p className="pb-2 text-center text-[0.7rem] text-subtle">{t.legal.footer}</p>
    </div>
  );
}
