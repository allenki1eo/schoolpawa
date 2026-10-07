import { cn } from "@/lib/client/cn";

/** Preset illustrated avatars (emoji on a tuned gradient — zero download cost). Never photos. */
export const AVATAR_ART: Record<string, { emoji: string; from: string; to: string }> = {
  simba: { emoji: "🦁", from: "#f59e0b", to: "#b45309" },
  twiga: { emoji: "🦒", from: "#fbbf24", to: "#a16207" },
  tembo: { emoji: "🐘", from: "#94a3b8", to: "#475569" },
  chui: { emoji: "🐆", from: "#f97316", to: "#9a3412" },
  nyati: { emoji: "🐃", from: "#a8a29e", to: "#44403c" },
  pundamilia: { emoji: "🦓", from: "#e2e8f0", to: "#64748b" },
  kiboko: { emoji: "🦛", from: "#c084fc", to: "#6b21a8" },
  faru: { emoji: "🦏", from: "#9ca3af", to: "#374151" },
  tai: { emoji: "🦅", from: "#60a5fa", to: "#1e40af" },
  kasuku: { emoji: "🦜", from: "#34d399", to: "#047857" },
  kobe: { emoji: "🐢", from: "#4ade80", to: "#166534" },
  pomboo: { emoji: "🐬", from: "#38bdf8", to: "#0369a1" },
};

export function Avatar({ avatar, size = 44, ring = false, className, label }: { avatar: string; size?: number; ring?: boolean; className?: string; label?: string }) {
  const art = AVATAR_ART[avatar] ?? AVATAR_ART.simba!;
  return (
    <span
      role="img"
      aria-label={label ?? avatar}
      className={cn("inline-grid shrink-0 place-items-center rounded-full", ring && "ring-2 ring-gold-400 ring-offset-2 ring-offset-ink-900", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${art.from}, ${art.to})`,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      <span aria-hidden>{art.emoji}</span>
    </span>
  );
}
