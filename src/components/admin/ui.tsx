import { cn } from "@/lib/client/cn";

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-black">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("surface overflow-x-auto rounded-2xl", className)}>
      <table className="w-full text-left text-sm [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-subtle [&_th]:uppercase [&_tr]:border-b [&_tr]:border-line">
        {children}
      </table>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "bg-white/8 text-muted",
    in_review: "bg-info/15 text-info",
    approved: "bg-success/15 text-success",
    retired: "bg-white/5 text-subtle",
    open: "bg-danger/15 text-danger",
    actioned: "bg-success/15 text-success",
    dismissed: "bg-white/8 text-muted",
    resolved_ok: "bg-success/15 text-success",
    resolved_void: "bg-white/8 text-muted",
    contained: "bg-info/15 text-info",
    notified: "bg-gold-400/15 text-gold-200",
    closed: "bg-white/8 text-muted",
  };
  return <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", tone[status] ?? "bg-white/8")}>{status.replace("_", " ")}</span>;
}

export function SmallButton({ children, tone = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "good" | "bad" }) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition-colors",
        tone === "good" && "bg-success/15 text-success ring-success/30 hover:bg-success/25",
        tone === "bad" && "bg-danger/15 text-danger ring-danger/30 hover:bg-danger/25",
        tone === "default" && "bg-white/5 text-muted ring-line hover:text-fg",
        props.className,
      )}
    >
      {children}
    </button>
  );
}

export const field = "h-10 w-full rounded-xl bg-ink-850 px-3 text-sm ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-gold-400";
