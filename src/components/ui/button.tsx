import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        gold: "bg-gradient-to-b from-gold-200 via-gold-400 to-gold-500 text-ink-950 shadow-[0_8px_24px_-8px_rgb(247_201_72/0.6)] hover:brightness-105",
        primary: "bg-fg text-ink-950 hover:bg-white",
        secondary: "bg-ink-800 text-fg ring-1 ring-line-strong hover:bg-ink-700",
        ghost: "text-muted hover:bg-white/5 hover:text-fg",
        danger: "bg-danger/15 text-danger ring-1 ring-danger/30 hover:bg-danger/25",
        accent: "bg-[var(--accent,#60a5fa)] text-ink-950 hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-12 px-5 text-[0.95rem]",
        lg: "h-14 px-6 text-base",
        icon: "size-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size, block }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
});
