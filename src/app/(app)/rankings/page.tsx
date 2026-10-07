import { Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/brand/avatar";
import { Crest } from "@/components/brand/crest";
import { RankBadge } from "@/components/brand/game";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";
import type { SizeBand } from "@/lib/ranking/school-power";
import { ensureStudentBoards, improvementAwards, placeOf, schoolBoard, studentBoard, studentRank, type BoardScope, type Period } from "@/server/leaderboard";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";

export const metadata = { title: "Viwango" };

const SCOPES: BoardScope[] = ["class", "school", "district", "region", "national"];
const SIZES: Array<SizeBand | "all"> = ["all", "S", "M", "L", "XL"];

type SP = { tab?: string; scope?: string; period?: string; size?: string };

export default async function RankingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const student = await requireStudent();
  const { t } = await getDict();
  const tab = sp.tab === "schools" ? "schools" : "students";
  const period: Period = sp.period === "all" ? "all" : "weekly";
  const scope = (SCOPES as string[]).includes(sp.scope ?? "") ? (sp.scope as BoardScope) : "school";
  const size = (SIZES as string[]).includes(sp.size ?? "") ? (sp.size as SizeBand | "all") : "all";
  const href = (patch: Partial<SP>) => `/rankings?${new URLSearchParams({ tab, scope, period, size, ...patch } as Record<string, string>)}`;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-black">{t.rankings.title}</h1>
      <Tabs
        items={[
          { href: href({ tab: "students" }), label: t.rankings.students, active: tab === "students" },
          { href: href({ tab: "schools" }), label: t.rankings.schools, active: tab === "schools" },
        ]}
      />
      <Tabs
        small
        items={[
          { href: href({ period: "weekly" }), label: t.common.weekly, active: period === "weekly" },
          { href: href({ period: "all" }), label: t.common.allTime, active: period === "all" },
        ]}
      />
      {tab === "students" ? <StudentBoard student={student} scope={scope} period={period} href={href} /> : <SchoolBoard student={student} period={period} size={size} href={href} />}
    </div>
  );
}

function Tabs({ items, small }: { items: Array<{ href: string; label: string; active: boolean }>; small?: boolean }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-ink-850 p-1 ring-1 ring-line">
      {items.map((i) => (
        <Link key={i.label} href={i.href} replace scroll={false} aria-current={i.active ? "page" : undefined} className={cn("flex flex-1 items-center justify-center rounded-xl font-semibold transition-colors", small ? "h-8 text-xs" : "h-10 text-sm", i.active ? "bg-ink-700 text-fg ring-1 ring-line-strong" : "text-subtle")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

function Chips({ items }: { items: Array<{ href: string; label: string; active: boolean }> }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {items.map((i) => (
        <Link key={i.label} href={i.href} replace scroll={false} className={cn("shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ring-1", i.active ? "bg-gold-400/15 text-gold-200 ring-gold-400/40" : "bg-ink-850 text-muted ring-line")}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

async function StudentBoard({ student, scope, period, href }: { student: Awaited<ReturnType<typeof requireStudent>>; scope: BoardScope; period: Period; href: (p: Partial<SP>) => string }) {
  const { t } = await getDict();
  await ensureStudentBoards();
  const place = (await placeOf(student.id))!;
  const [rows, mine] = await Promise.all([studentBoard(period, scope, place, 50), studentRank(period, scope, place)]);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="space-y-5">
      <Chips items={SCOPES.map((s) => ({ href: href({ scope: s }), label: t.rankings.scopes[s], active: s === scope }))} />

      <Card className="flex items-center gap-3 p-4 ring-1 ring-gold-400/30">
        <Avatar avatar={student.avatar} size={44} ring />
        <div className="flex-1">
          <p className="text-xs text-subtle">{t.rankings.yourRank}</p>
          <p className="font-bold">{mine.rank ? <span className="num text-gold-gradient font-display text-2xl font-black">#{mine.rank}</span> : t.rankings.unranked}{mine.rank ? <span className="num text-sm text-subtle"> / {mine.total}</span> : null}</p>
        </div>
        <span className="num font-display text-xl font-black">{mine.score.toLocaleString("en-US")}</span>
      </Card>

      {rows.length === 0 ? <p className="py-8 text-center text-sm text-subtle">{t.rankings.noData}</p> : null}

      {podium.length > 0 ? (
        <div className="grid grid-cols-3 items-end gap-2 pt-4">
          {[podium[1], podium[0], podium[2]].map((r, i) =>
            r ? (
              <div key={r.studentId} className="flex flex-col items-center text-center motion-safe:animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
                <Avatar avatar={r.avatar} size={r.rank === 1 ? 64 : 52} ring={r.rank === 1} />
                <p className="mt-2 w-full truncate text-sm font-bold">{r.nickname}</p>
                <p className="w-full truncate text-[0.65rem] text-subtle">{r.schoolName}</p>
                <div
                  className={cn(
                    "mt-2 flex w-full flex-col items-center justify-start rounded-t-2xl pt-2",
                    r.rank === 1 ? "h-28 bg-gradient-to-b from-gold-400/40 to-gold-400/5 ring-1 ring-gold-400/40" : r.rank === 2 ? "h-20 bg-gradient-to-b from-slate-300/25 to-transparent" : "h-14 bg-gradient-to-b from-orange-400/25 to-transparent",
                  )}
                >
                  <RankBadge rank={r.rank} />
                  <span className="num text-sm font-black">{r.score.toLocaleString("en-US")}</span>
                </div>
              </div>
            ) : (
              <div key={i} />
            ),
          )}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <ol className="surface divide-y divide-line overflow-hidden rounded-3xl">
          {rest.map((r) => (
            <li key={r.studentId} className={cn("flex items-center gap-3 px-3 py-2.5", r.studentId === student.id && "bg-gold-400/[0.07]")}>
              <RankBadge rank={r.rank} />
              <Avatar avatar={r.avatar} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.nickname}</p>
                <p className="truncate text-xs text-subtle">{r.schoolName}</p>
              </div>
              <span className="num font-bold">{r.score.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

async function SchoolBoard({ student, period, size, href }: { student: Awaited<ReturnType<typeof requireStudent>>; period: Period; size: SizeBand | "all"; href: (p: Partial<SP>) => string }) {
  const { t } = await getDict();
  const stage = student.gradeLevelId.startsWith("std") ? "primary" : "secondary";
  const [board, awards] = await Promise.all([schoolBoard({ stage, period, sizeBand: size }), period === "weekly" ? improvementAwards(stage) : null]);

  return (
    <div className="space-y-5">
      <Chips items={SIZES.map((s) => ({ href: href({ size: s }), label: s === "all" ? t.rankings.allSizes : `${s} · ${t.rankings.sizes[s]}`, active: s === size }))} />

      <details className="surface rounded-2xl px-4 py-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-muted">
          <Info className="size-4" aria-hidden /> {t.rankings.schoolPower} · {stage === "primary" ? t.rankings.primary : t.rankings.secondary}
        </summary>
        <p className="mt-2 leading-relaxed text-subtle">{t.rankings.powerExplain}</p>
      </details>

      {awards && (awards.student || awards.school) ? (
        <Card className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-success"><TrendingUp className="size-4" aria-hidden /> {t.rankings.mostImproved}</p>
          {awards.student ? (
            <div className="flex items-center gap-3">
              <Avatar avatar={awards.student.avatar} size={36} />
              <p className="flex-1 text-sm"><span className="text-subtle">{t.rankings.improvedStudent}: </span><span className="font-semibold">{awards.student.nickname}</span></p>
              <span className="num text-sm font-bold text-success">+{awards.student.gain}</span>
            </div>
          ) : null}
          {awards.school ? (
            <div className="flex items-center gap-3">
              <Crest name={awards.school.name} regNo={awards.school.regNo} color={awards.school.regionColor} size={30} />
              <p className="flex-1 truncate text-sm"><span className="text-subtle">{t.rankings.improvedSchool}: </span><span className="font-semibold">{awards.school.name}</span></p>
              <span className="num text-sm font-bold text-success">+{Math.round(awards.school.gain * 100)}%</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      {board.rows.length === 0 ? <p className="py-8 text-center text-sm text-subtle">{t.rankings.noData}</p> : null}

      <ol className="space-y-2">
        {board.rows.map((r) => {
          const mine = r.schoolId === student.schoolId;
          return (
            <li key={r.schoolId} className={cn("surface flex items-center gap-3 rounded-2xl px-3 py-3", mine && "ring-2 ring-gold-400/60", r.rank === 1 && "shadow-[var(--shadow-glow-gold)]")}>
              <RankBadge rank={r.rank} />
              <Crest name={r.name} regNo={r.regNo} color={r.regionColor} size={38} glow={r.rank === 1} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-xs text-subtle">
                  {r.districtName} · <span className="num">{fmt(t.rankings.active, { n: r.activeStudents })}</span> · {r.sizeBand}
                </p>
              </div>
              <div className="text-right">
                <p className={cn("num font-display text-lg font-black", r.rank <= 3 ? "text-gold-gradient" : "")}>{r.power.toFixed(1)}</p>
                {r.participationBonus > 0.001 ? <p className="num text-[0.65rem] text-success">+{(r.participationBonus * 100).toFixed(1)}%</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
