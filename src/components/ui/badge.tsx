import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

const badge = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", {
  variants: {
    tone: {
      neutral: "bg-white/6 text-muted ring-1 ring-line",
      gold: "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/30",
      success: "bg-success/12 text-success ring-1 ring-success/25",
      danger: "bg-danger/12 text-danger ring-1 ring-danger/25",
      info: "bg-info/12 text-info ring-1 ring-info/25",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
