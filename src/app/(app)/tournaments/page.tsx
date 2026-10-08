import { CalendarClock, ChevronRight, Trophy } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/challenges/challenges-view";
import { Countdown } from "@/components/game/countdown";
import { cn } from "@/lib/client/cn";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { tournamentPhase, tournamentsForStudent } from "@/server/tournaments";
import { studentContext } from "@/server/views";

export const metadata = { title: "Mashindano" };

export default async function TournamentsPage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const ctx = await studentContext(student);
  const list = await tournamentsForStudent(ctx.stage, ctx.regionId);
  const order = { live: 0, upcoming: 1, finished: 2, cancelled: 3 } as const;
  const rows = list.map((x) => ({ ...x, phase: tournamentPhase(x) })).sort((a, b) => order[a.phase] - order[b.phase]);

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/30 via-fuchsia-500/10 to-transparent p-5 ring-1 ring-violet-400/30">
        <div aria-hidden className="absolute -right-4 -bottom-6 text-[8rem] leading-none opacity-20">🏆</div>
        <h1 className="font-display relative text-3xl font-black">{t.tournaments.title}</h1>
        <p className="relative mt-2 max-w-xs text-sm text-muted">{t.tournaments.howItWorks}</p>
      </header>

      {rows.length === 0 ? <EmptyState icon={<Trophy className="size-8" aria-hidden />} text={t.tournaments.empty} /> : null}

      <ul className="space-y-3">
        {rows.map((x) => (
          <li key={x.id}>
            <Link href={`/tournaments/${x.id}`} className={cn("surface flex items-center gap-4 rounded-3xl p-4", x.phase === "live" && "ring-2 ring-violet-400/50")}>
              <span className={cn("grid size-12 place-items-center rounded-2xl text-2xl", x.phase === "live" ? "bg-violet-500/25" : "bg-white/5")}>🏆</span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                  {x.phase === "live" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger px-1.5 py-0.5 text-[0.6rem] font-black text-white">
                      <span className="size-1.5 rounded-full bg-white motion-safe:animate-pulse" /> {t.tournaments.live}
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-bold text-subtle uppercase">{x.phase === "upcoming" ? t.tournaments.upcoming : t.tournaments.finished}</span>
                  )}
                  <span className="text-[0.65rem] text-subtle">{x.regionId ? t.tournaments.region : t.tournaments.national}</span>
                </div>
                <p className="truncate font-bold">{locale === "sw" ? x.titleSw : x.titleEn}</p>
                {x.phase !== "finished" ? (
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {(x.phase === "live" ? t.tournaments.endsIn : t.tournaments.startsIn).split("{time}")[0]}
                    <Countdown to={(x.phase === "live" ? x.endsAt : x.startsAt).toISOString()} className="font-semibold text-fg" />
                  </p>
                ) : null}
              </div>
              <ChevronRight className="size-5 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
