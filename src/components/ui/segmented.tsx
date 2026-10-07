"use client";

import { cn } from "@/lib/client/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-2xl bg-ink-850 p-1 ring-1 ring-line", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl font-semibold transition-colors",
            size === "sm" ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm",
            value === o.value ? "bg-ink-700 text-fg shadow-sm ring-1 ring-line-strong" : "text-subtle hover:text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
