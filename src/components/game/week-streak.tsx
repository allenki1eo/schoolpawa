import { Flame } from "lucide-react";
import { cn } from "@/lib/client/cn";

/** Mon–Sun row: filled flames for days played this week, a pulsing ring on today. */
export function WeekStreak({ active, todayIndex, labels, title, hint }: { active: boolean[]; todayIndex: number; labels: string[]; title: string; hint: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-muted">{title}</span>
        <span className={cn("font-semibold", active[todayIndex] ? "text-success" : "text-orange-300")}>{hint}</span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {labels.map((label, i) => {
          const on = active[i];
          const today = i === todayIndex;
          return (
            <li key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl ring-1 transition-colors",
                  on ? "bg-gradient-to-b from-orange-400/35 to-orange-600/15 text-orange-300 ring-orange-400/40" : "bg-white/[0.03] text-ink-600 ring-line",
                  today && !on && "ring-2 ring-orange-400/60 motion-safe:animate-pulse",
                  today && on && "ring-2 ring-orange-300",
                )}
                aria-label={`${label}${on ? " ✓" : ""}`}
              >
                <Flame className={cn("size-4", on && "motion-safe:animate-flame")} fill={on ? "currentColor" : "none"} aria-hidden />
              </span>
              <span className={cn("text-[0.6rem] font-bold", today ? "text-fg" : "text-subtle")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
