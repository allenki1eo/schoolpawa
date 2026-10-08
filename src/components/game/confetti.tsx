"use client";

import { useMemo } from "react";

/**
 * CSS-only confetti burst (no canvas, no library). ~40 transformed divs, GPU-cheap, and fully
 * hidden under prefers-reduced-motion.
 */
/** Tiny deterministic generator so server and client agree and renders are pure. */
function lcg(seed: number) {
  const state = { x: seed * 9301 + 49297 };
  return () => {
    state.x = (state.x * 9301 + 49297) % 233280;
    return state.x / 233280;
  };
}

export function Confetti({ count = 40, seed = 1 }: { count?: number; seed?: number }) {
  const pieces = useMemo(() => {
    const rand = lcg(seed);
    const colors = ["#f7c948", "#ffe08a", "#38bdf8", "#34d399", "#fb7185", "#a78bfa"];
    return Array.from({ length: count }, (_, i) => ({
      left: rand() * 100,
      delay: rand() * 0.35,
      duration: 1.6 + rand() * 1.2,
      drift: (rand() - 0.5) * 160,
      rotate: rand() * 720,
      size: 6 + rand() * 6,
      color: colors[i % colors.length]!,
      round: rand() > 0.6,
    }));
  }, [count, seed]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden motion-reduce:hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-[-5%] block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? 999 : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
