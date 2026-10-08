"use client";

import { CalendarCheck2, Check, Compass, Flame, Gift, Heart, Play, Star, Swords, Trophy, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { api, haptic } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import type { QuestState } from "@/lib/game/quests";
import { Confetti } from "./confetti";

const ICONS: Record<QuestState["icon"], LucideIcon> = {
  play: Play, flame: Flame, calendar: CalendarCheck2, swords: Swords, star: Star, trophy: Trophy, heart: Heart, compass: Compass,
};

export function QuestBoard({ quests, period }: { quests: QuestState[]; period: "daily" | "weekly" }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const list = quests.filter((q) => q.period === period);
  const done = list.filter((q) => q.claimed).length;

  const claim = async (q: QuestState) => {
    setBusy(q.key);
    const r = await api<{ reward: number }>("/api/quests/claim", { body: { key: q.key } });
    setBusy(null);
    if (!r.ok) return toast(errorMessage(t, r.error), "error");
    haptic([15, 40, 15]);
    setBurst((b) => b + 1);
    toast(fmt(t.quests.claimedToast, { n: r.data.reward }), "success");
    router.refresh();
  };

  return (
    <section className="surface relative overflow-hidden rounded-3xl p-4">
      {burst > 0 ? <Confetti key={burst} seed={burst} count={30} /> : null}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold">
          <Gift className="size-5 text-gold-400" aria-hidden />
          {period === "daily" ? t.quests.title : t.quests.weeklyTitle}
        </h2>
        <span className="num rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-muted ring-1 ring-line">
          {done}/{list.length}
        </span>
      </div>
      <ul className="space-y-2.5">
        {list.map((q) => {
          const Icon = ICONS[q.icon];
          return (
            <li
              key={q.key}
              className={cn(
                "relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 ring-1 transition-colors",
                q.claimable ? "bg-gold-400/10 ring-gold-400/40" : q.claimed ? "bg-success/[0.06] ring-success/20" : "bg-white/[0.03] ring-line",
              )}
            >
              {q.claimable ? <span aria-hidden className="shimmer absolute inset-0" /> : null}
              <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl", q.claimed ? "bg-success/15 text-success" : q.claimable ? "bg-gold-400/20 text-gold-300" : "bg-white/5 text-muted")}>
                {q.claimed ? <Check className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              </span>
              <div className="relative min-w-0 flex-1">
                <p className={cn("line-clamp-2 text-sm leading-snug font-semibold", q.claimed && "text-muted line-through decoration-success/50")}>
                  {(t.quests.names as Record<string, string>)[q.key] ?? q.key}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <span
                      className={cn("block h-full rounded-full transition-[width] duration-700", q.complete ? "bg-gradient-to-r from-gold-500 to-gold-200" : "bg-sky-400")}
                      style={{ width: `${(q.progress / q.target) * 100}%` }}
                    />
                  </span>
                  <span className="num text-[0.7rem] font-bold text-subtle">
                    {q.progress}/{q.target}
                  </span>
                </div>
              </div>
              {q.claimable ? (
                <button
                  type="button"
                  disabled={busy === q.key}
                  onClick={() => claim(q)}
                  className="relative shrink-0 rounded-xl bg-gradient-to-b from-gold-200 via-gold-400 to-gold-500 px-3 py-2 text-xs font-black text-ink-950 shadow-[0_6px_18px_-6px_rgb(247_201_72/0.8)] active:scale-95 motion-safe:animate-pop"
                >
                  {t.quests.claim} {fmt(t.quests.reward, { n: q.reward })}
                </button>
              ) : (
                <span className={cn("num relative shrink-0 text-xs font-bold", q.claimed ? "text-success" : "text-gold-200/70")}>
                  {q.claimed ? t.quests.claimed : fmt(t.quests.reward, { n: q.reward })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-center text-[0.7rem] text-subtle">{period === "daily" ? t.quests.resetsDaily : t.quests.resetsWeekly}</p>
    </section>
  );
}
