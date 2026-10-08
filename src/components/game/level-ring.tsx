import { Avatar } from "@/components/brand/avatar";
import { cn } from "@/lib/client/cn";

/** Avatar wrapped in a circular XP ring: the player's level progress at a glance. */
export function LevelRing({ avatar, progress, level, size = 88, className }: { avatar: string; progress: number; level: number; size?: number; className?: string }) {
  const stroke = 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <linearGradient id="lr-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#e8b22e" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#lr-g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
          style={{ filter: "drop-shadow(0 0 6px rgb(247 201 72 / 0.55))" }}
        />
      </svg>
      <Avatar avatar={avatar} size={size - stroke * 4} />
      <span className="num absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold-200 to-gold-500 px-2 py-0.5 text-[0.7rem] font-black text-ink-950 shadow-[0_4px_12px_-2px_rgb(247_201_72/0.6)] ring-2 ring-ink-950">
        LV {level}
      </span>
    </span>
  );
}
