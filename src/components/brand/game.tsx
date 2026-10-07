import { Crown, Flame, Medal } from "lucide-react";
import { cn } from "@/lib/client/cn";

export function StreakFlame({ days, className }: { days: number; className?: string }) {
  const hot = days >= 3;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-orange-500/12 px-2.5 py-1 text-sm font-bold text-orange-300 ring-1 ring-orange-400/25", className)}>
      <Flame className={cn("size-4", hot && "motion-safe:animate-flame")} fill={hot ? "currentColor" : "none"} aria-hidden />
      <span className="num">{days}</span>
    </span>
  );
}

const MEDAL = ["text-gold-400", "text-silver", "text-bronze"];

/** Rank number with a medal for the podium. Medal colour is paired with the number (not colour-only). */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  if (rank <= 3) {
    return (
      <span className={cn("relative inline-grid size-9 place-items-center", className)} aria-label={`#${rank}`}>
        {rank === 1 ? <Crown className={cn("absolute -top-2.5 size-4", MEDAL[0])} fill="currentColor" aria-hidden /> : null}
        <Medal className={cn("size-8", MEDAL[rank - 1])} aria-hidden />
        <span className="num absolute top-[0.95rem] text-[0.62rem] font-black text-ink-950">{rank}</span>
      </span>
    );
  }
  return <span className={cn("num inline-grid size-9 place-items-center text-sm font-bold text-subtle", className)}>{rank}</span>;
}

export function SubjectDot({ accent, className }: { accent: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 rounded-full", className)} style={{ background: accent, boxShadow: `0 0 12px ${accent}` }} />;
}
