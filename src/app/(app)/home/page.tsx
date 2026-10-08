import { and, count, eq, isNull } from "drizzle-orm";
import { ArrowRight, CalendarCheck2, ChevronRight, Gauge, Hourglass, Map, Swords, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { db, schema } from "@/db/client";
import { Crest } from "@/components/brand/crest";
import { SubjectIcon } from "@/components/app/subject-icon";
import { Countdown } from "@/components/game/countdown";
import { LevelRing } from "@/components/game/level-ring";
import { QuestBoard } from "@/components/game/quest-board";
import { Stars } from "@/components/game/stars";
import { WeekStreak } from "@/components/game/week-streak";
import { StartQuizButton } from "@/components/quiz/start-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { starsFor } from "@/lib/game/mastery";
import { fmt, pick } from "@/lib/i18n";
import { levelFor } from "@/lib/ranking/levels";
import { ensureStudentBoards, placeOf, schoolBoard, studentRank } from "@/server/leaderboard";
import { pendingPoints } from "@/server/ledger";
import { getDict } from "@/server/locale";
import { questsFor } from "@/server/quests";
import { requireStudent } from "@/server/session";
import { liveTournament } from "@/server/tournaments";
import { activeDaysThisWeek, dailyStatus, studentContext, subjectsWithTopics, topicBests } from "@/server/views";

export const metadata = { title: "Nyumbani" };

export default async function HomePage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const ctx = await studentContext(student);
  await ensureStudentBoards();
  const place = (await placeOf(student.id))!;
  const [daily, subjects, pending, board, waiting, quests, week, bests, classRank, tournament] = await Promise.all([
    dailyStatus(student),
    subjectsWithTopics(student.gradeLevelId),
    pendingPoints(student.id),
    schoolBoard({ stage: ctx.stage, period: "weekly" }),
    db
      .select({ n: count() })
      .from(schema.challenges)
      .where(and(eq(schema.challenges.opponentId, student.id), eq(schema.challenges.status, "open"), isNull(schema.challenges.opponentSessionId))),
    questsFor(student.id),
    activeDaysThisWeek(student.id),
    topicBests(student.id),
    studentRank("weekly", "class", place),
    liveTournament(ctx.stage, ctx.regionId),
  ]);
  const level = levelFor(student.xp);
  const mySchool = board.rows.find((r) => r.schoolId === student.schoolId);
  const waitingCount = waiting[0]?.n ?? 0;
  const topics = subjects.flatMap(({ subject, topics }) => topics.map((topic) => ({ topic, subject })));
  const nextTopics = [...topics].sort((a, b) => starsFor(bests.get(a.topic.id)?.best) - starsFor(bests.get(b.topic.id)?.best)).slice(0, 3);
  const dayLabels = t.streakWeek.days.split(",");

  return (
    <div className="space-y-5">
      {/* Player card */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1b2a52] via-[#111b36] to-[#0a1224] p-5 ring-1 ring-white/10 motion-safe:animate-rise">
        <div aria-hidden className="kanga-edge absolute inset-x-0 top-0 h-1.5" />
        <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full bg-gold-400/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-10 size-48 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <LevelRing avatar={student.avatar} progress={level.progress} level={level.index + 1} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gold-200/80">{t.levels[level.key]}</p>
            <h1 className="font-display truncate text-2xl leading-tight font-black">{fmt(t.home.greeting, { name: student.nickname })}</h1>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
              <Crest name={ctx.schoolName} regNo={ctx.regNo} color={ctx.regionColor} size={16} />
              <span className="truncate">{ctx.schoolName}</span>
              <span className="text-subtle">· {locale === "sw" ? ctx.gradeSw : ctx.gradeEn}</span>
            </p>
          </div>
        </div>
        <div className="relative mt-4">
          <Progress value={level.progress} className="h-2" label={t.home.level} />
          <p className="mt-1.5 text-[0.7rem] text-subtle">
            {level.next ? fmt(t.home.toNext, { n: level.xpToNext.toLocaleString("en-US"), level: t.levels[level.next] }) : t.home.maxLevel}
          </p>
        </div>
        <dl className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Zap className="size-3.5" fill="currentColor" aria-hidden />} label={t.common.xp} value={student.xp.toLocaleString("en-US")} gold />
          <Stat icon={<Trophy className="size-3.5" aria-hidden />} label={t.rankings.scopes.class} value={classRank.rank ? `#${classRank.rank}` : "–"} />
          <Stat icon={<Gauge className="size-3.5" aria-hidden />} label="1v1" value={String(student.rating)} />
        </dl>
        <div className="relative mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/5">
          <WeekStreak active={week.active} todayIndex={week.todayIndex} labels={dayLabels} title={t.streakWeek.title} hint={week.active[week.todayIndex] ? t.streakWeek.safe : t.streakWeek.keepAlive} />
        </div>
      </section>

      {pending > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-info/10 px-4 py-3 text-sm text-info ring-1 ring-info/25">
          <Hourglass className="size-4" aria-hidden /> {fmt(t.home.pending, { n: pending })}
        </p>
      ) : null}

      {waitingCount > 0 ? (
        <Link href="/challenges" className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-danger/20 to-danger/5 px-4 py-3.5 text-sm font-bold text-red-100 ring-1 ring-danger/35">
          <span className="grid size-9 place-items-center rounded-xl bg-danger/25 motion-safe:animate-pulse">
            <Swords className="size-5" aria-hidden />
          </span>
          <span className="flex-1">{fmt(t.home.challengesWaiting, { n: waitingCount })}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}

      {/* Live tournament */}
      {tournament ? (
        <Link
          href={`/tournaments/${tournament.id}`}
          className="relative block overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-transparent p-4 ring-1 ring-violet-400/35"
        >
          <div aria-hidden className="absolute -right-6 -bottom-8 text-[7rem] leading-none opacity-15">🏆</div>
          <div className="relative flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2 py-0.5 text-[0.65rem] font-black tracking-wider text-white">
              <span className="size-1.5 rounded-full bg-white motion-safe:animate-pulse" /> {t.tournaments.live}
            </span>
            <span className="text-xs font-semibold text-violet-200">{t.tournaments.banner}</span>
          </div>
          <p className="font-display relative mt-2 text-xl font-black">{locale === "sw" ? tournament.titleSw : tournament.titleEn}</p>
          <p className="relative mt-1 text-sm text-muted">
            {t.tournaments.endsIn.split("{time}")[0]}
            <Countdown to={tournament.endsAt.toISOString()} className="font-bold text-fg" />
          </p>
        </Link>
      ) : null}

      {/* Daily challenge */}
      {daily ? (
        <section
          className="relative overflow-hidden rounded-3xl p-5 ring-1 ring-gold-400/30"
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

      <QuestBoard quests={quests} period="daily" />

      {/* Learning map teaser */}
      <section className="surface rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold">
            <Map className="size-5 text-sky-300" aria-hidden /> {t.map.title}
          </h2>
          <Link href="/learn" className="text-sm font-semibold text-gold-200">{t.common.seeAll}</Link>
        </div>
        <ul className="space-y-2">
          {nextTopics.map(({ topic, subject }) => {
            const best = bests.get(topic.id)?.best;
            return (
              <li key={topic.id}>
                <Link href={`/learn/${topic.id}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-line transition-colors hover:bg-white/[0.06]">
                  <SubjectIcon icon={subject.icon} accent={subject.accent} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{pick(topic, "name", locale)}</span>
                    <span className="text-[0.7rem]" style={{ color: subject.accent }}>{pick(subject, "name", locale)}</span>
                  </span>
                  <Stars value={starsFor(best)} size={14} label={fmt(t.map.stars, { n: starsFor(best) })} />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* School card */}
      <Link href="/rankings?tab=schools" className="block">
        <section className="surface flex items-center gap-4 rounded-3xl p-4 transition-transform active:scale-[0.99]">
          <Crest name={ctx.schoolName} regNo={ctx.regNo} color={ctx.regionColor} size={52} glow={mySchool?.rank === 1} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-semibold text-subtle uppercase">{t.home.schoolCard}</p>
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
        </section>
      </Link>

      <QuestBoard quests={quests} period="weekly" />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/challenges?new=1" className="surface flex flex-col gap-2 rounded-3xl p-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-danger/15 text-red-300 ring-1 ring-danger/30">
            <Swords className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-bold">{t.home.challengeFriend}</span>
        </Link>
        <Link href="/tournaments" className="surface flex flex-col gap-2 rounded-3xl p-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30">
            <Trophy className="size-5" aria-hidden />
          </span>
          <span className="text-sm font-bold">{t.tournaments.title}</span>
        </Link>
      </div>

      <p className="pb-2 text-center text-[0.7rem] text-subtle">{t.legal.footer}</p>
    </div>
  );
}

function Stat({ icon, label, value, gold }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/20 px-2 py-2.5 ring-1 ring-white/5">
      <dt className="flex items-center justify-center gap-1 text-[0.65rem] font-semibold text-subtle">
        {icon}
        {label}
      </dt>
      <dd className={`num font-display mt-0.5 text-lg font-black ${gold ? "text-gold-gradient" : ""}`}>{value}</dd>
    </div>
  );
}
