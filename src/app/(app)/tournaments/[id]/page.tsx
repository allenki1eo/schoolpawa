import { eq, inArray } from "drizzle-orm";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { Crest } from "@/components/brand/crest";
import { RankBadge } from "@/components/brand/game";
import { SubjectIcon } from "@/components/app/subject-icon";
import { Countdown } from "@/components/game/countdown";
import { cn } from "@/lib/client/cn";
import { fmt, pick } from "@/lib/i18n";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { myTournamentPoints, tournamentBoard, tournamentPhase } from "@/server/tournaments";
import { studentContext } from "@/server/views";

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const ctx = await studentContext(student);
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id));
  if (!tournament || tournament.stage !== ctx.stage || (tournament.regionId && tournament.regionId !== ctx.regionId)) notFound();
  const phase = tournamentPhase(tournament);
  const [board, mine, topics] = await Promise.all([
    tournamentBoard(tournament),
    myTournamentPoints(tournament, student.id),
    tournament.topicIds.length
      ? db.select({ topic: schema.topics, subject: schema.subjects }).from(schema.topics).innerJoin(schema.subjects, eq(schema.subjects.id, schema.topics.subjectId)).where(inArray(schema.topics.id, tournament.topicIds))
      : [],
  ]);
  const myTopics = topics.filter((x) => x.topic.gradeLevelId === student.gradeLevelId && x.topic.isLive);
  const champion = phase === "finished" ? board[0] : undefined;

  return (
    <div className="space-y-6">
      <Link href="/tournaments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" aria-hidden /> {t.tournaments.title}
      </Link>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/35 via-fuchsia-500/10 to-transparent p-5 ring-1 ring-violet-400/30">
        <div aria-hidden className="absolute -right-4 -bottom-6 text-[8rem] leading-none opacity-20">🏆</div>
        <p className="relative text-xs font-black tracking-wider text-violet-200 uppercase">
          {phase === "live" ? `● ${t.tournaments.live}` : phase === "upcoming" ? t.tournaments.upcoming : t.tournaments.finished}
        </p>
        <h1 className="font-display relative mt-1 text-2xl font-black">{locale === "sw" ? tournament.titleSw : tournament.titleEn}</h1>
        {phase !== "finished" ? (
          <p className="relative mt-2 text-sm text-muted">
            {(phase === "live" ? t.tournaments.endsIn : t.tournaments.startsIn).split("{time}")[0]}
            <Countdown to={(phase === "live" ? tournament.endsAt : tournament.startsAt).toISOString()} className="font-bold text-fg" />
          </p>
        ) : null}
        <p className="num relative mt-3 inline-block rounded-full bg-black/25 px-3 py-1 text-sm font-bold text-gold-200">{fmt(t.tournaments.yourPoints, { n: mine.points })}</p>
      </header>

      {champion ? (
        <div className="surface flex flex-col items-center gap-2 rounded-3xl p-6 text-center ring-1 ring-gold-400/40">
          <Crest name={champion.name} regNo={champion.regNo} color={champion.regionColor} size={72} glow />
          <p className="text-xs font-black tracking-wider text-gold-300 uppercase">{t.tournaments.champion}</p>
          <p className="font-display text-xl font-black">{champion.name}</p>
        </div>
      ) : null}

      <section>
        <h2 className="font-display mb-3 text-lg font-bold">{t.tournaments.themeTopics}</h2>
        <ul className="grid gap-2">
          {myTopics.map(({ topic, subject }) => (
            <li key={topic.id}>
              <Link href={`/learn/${topic.id}`} className="surface flex items-center gap-3 rounded-2xl p-3">
                <SubjectIcon icon={subject.icon} accent={subject.accent} size={40} />
                <span className="flex-1 text-sm font-bold">{pick(topic, "name", locale)}</span>
                {phase === "live" ? (
                  <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-b from-gold-200 to-gold-500 px-3 py-1.5 text-xs font-black text-ink-950">
                    <Play className="size-3" fill="currentColor" aria-hidden /> {t.challenges.play}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display mb-3 text-lg font-bold">{t.rankings.schoolPower}</h2>
        {board.length === 0 ? <p className="text-sm text-subtle">{t.rankings.noData}</p> : null}
        <ol className="space-y-2">
          {board.map((r) => (
            <li key={r.schoolId} className={cn("surface flex items-center gap-3 rounded-2xl px-3 py-3", r.schoolId === student.schoolId && "ring-2 ring-gold-400/60")}>
              <RankBadge rank={r.rank} />
              <Crest name={r.name} regNo={r.regNo} color={r.regionColor} size={34} glow={r.rank === 1} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="num truncate text-xs text-subtle">{r.districtName} · {fmt(t.rankings.active, { n: r.activeStudents })}</p>
              </div>
              <span className={cn("num font-display text-lg font-black", r.rank <= 3 && "text-gold-gradient")}>{r.power.toFixed(1)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
