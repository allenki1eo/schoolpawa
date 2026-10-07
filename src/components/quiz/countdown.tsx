"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";

/**
 * Countdown ring driven by a server-derived deadline. Purely visual: the server is the timer of
 * record (answers after limit + grace score zero regardless of what the client shows).
 */
export function CountdownRing({ deadline, limitMs, running, onExpire, label }: { deadline: number; limitMs: number; running: boolean; onExpire: () => void; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [deadline]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);
  const left = Math.max(0, deadline - now);
  useEffect(() => {
    if (running && left === 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [left, running, onExpire]);

  const secs = Math.ceil(left / 1000);
  const frac = left / limitMs;
  const r = 18;
  const c = 2 * Math.PI * r;
  const urgent = secs <= 5;
  return (
    <span className={cn("relative grid size-12 place-items-center", urgent && running && "motion-safe:animate-pulse")} role="timer" aria-label={fmt(label, { n: secs })}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={urgent ? "var(--color-danger)" : "var(--accent, var(--color-gold-400))"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 200ms linear" }}
        />
      </svg>
      <span className={cn("num text-sm font-black", urgent ? "text-danger" : "text-fg")}>{secs}</span>
    </span>
  );
}
