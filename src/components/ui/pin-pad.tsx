"use client";

import { Delete } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/client/cn";
import { haptic } from "@/lib/client/api";

/** Large-target numeric keypad for PINs (works without a system keyboard popping up). */
export function PinPad({ value, onChange, length = 4, error, label }: { value: string; onChange: (v: string) => void; length?: number; error?: boolean; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key) && value.length < length) onChange(value + e.key);
      if (e.key === "Backspace") onChange(value.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, length]);

  const press = (d: string) => {
    haptic(8);
    if (value.length < length) onChange(value + d);
  };
  return (
    <div className="flex flex-col items-center gap-6">
      <div role="status" aria-label={label} className={cn("flex gap-4", error && "motion-safe:animate-shake")}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full ring-2 transition-all duration-150",
              i < value.length ? "scale-110 bg-gold-400 ring-gold-400" : "bg-transparent ring-line-strong",
              error && "bg-danger ring-danger",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => (k === "⌫" ? onChange(value.slice(0, -1)) : press(k))}
              aria-label={k === "⌫" ? "Delete" : k}
              className="num grid size-[4.25rem] place-items-center rounded-full bg-ink-800 text-2xl font-bold ring-1 ring-line transition-transform active:scale-90 active:bg-ink-700"
            >
              {k === "⌫" ? <Delete className="size-6 text-muted" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
