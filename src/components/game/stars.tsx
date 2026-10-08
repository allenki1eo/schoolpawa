import { Star } from "lucide-react";
import { cn } from "@/lib/client/cn";

export function Stars({ value, size = 16, className, label }: { value: 0 | 1 | 2 | 3; size?: number; className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label ?? `${value}/3`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden
          style={{ width: size, height: size }}
          className={i < value ? "text-gold-400 drop-shadow-[0_0_6px_rgb(247_201_72/0.6)]" : "text-ink-600"}
          fill="currentColor"
        />
      ))}
    </span>
  );
}
