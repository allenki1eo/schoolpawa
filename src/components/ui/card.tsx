import type { HTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-3xl p-5", className)} {...props} />;
}

export function SectionTitle({ className, children, action }: { className?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-bold text-fg">{children}</h2>
      {action}
    </div>
  );
}
