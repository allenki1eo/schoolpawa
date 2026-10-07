import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-14 w-full rounded-2xl bg-ink-850 px-4 text-base text-fg ring-1 ring-line-strong transition-shadow placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-gold-400",
        invalid && "ring-2 ring-danger",
        className,
      )}
      {...props}
    />
  );
});

export function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-2 block text-sm font-medium text-muted", className)}>
      {children}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
      <span aria-hidden>⚠</span>
      {children}
    </p>
  );
}
