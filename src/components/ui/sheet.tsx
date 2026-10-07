"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/client/cn";

/** Bottom sheet built on <dialog> (focus trap + Esc for free, no library). */
export function Sheet({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none bg-transparent p-0 text-fg backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md",
        className,
      )}
    >
      <div className="surface pb-safe mx-auto w-full max-w-lg rounded-t-3xl p-5 motion-safe:animate-rise sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/5">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
