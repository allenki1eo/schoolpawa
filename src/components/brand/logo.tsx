import { cn } from "@/lib/client/cn";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.55" stopColor="#f7c948" />
          <stop offset="1" stopColor="#e8b22e" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#0e182f" stroke="url(#lm-g)" strokeWidth="2" />
      <path d="M27.5 8 13 27h9.5L19 40l16-20.5h-9.8z" fill="url(#lm-g)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-xl font-extrabold tracking-tight">
        School <span className="text-gold-gradient">Pawa</span>
      </span>
    </span>
  );
}
