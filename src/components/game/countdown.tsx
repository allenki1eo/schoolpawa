"use client";

import { useEffect, useState } from "react";

/** "2d 4h" / "3h 12m" / "4m 09s" — updates every second only when under an hour. */
export function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function Countdown({ to, className }: { to: string; className?: string }) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, target - Date.now() < 3_600_000 ? 1000 : 30_000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, [target]);
  return (
    <span className={`num ${className ?? ""}`} suppressHydrationWarning>
      {now === null ? "…" : formatRemaining(target - now)}
    </span>
  );
}
