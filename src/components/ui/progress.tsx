import { cn } from "@/lib/client/cn";

export function Progress({ value, className, tone = "gold", label }: { value: number; className?: string; tone?: "gold" | "accent"; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-ink-700", className)}
    >
      <div
        className={cn(
          "h-full origin-left rounded-full transition-[width] duration-700 ease-out",
          tone === "gold" ? "bg-gradient-to-r from-gold-500 via-gold-400 to-gold-200" : "bg-[var(--accent)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
