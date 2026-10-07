"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/providers/i18n";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = locale === "sw" ? "en" : "sw";
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`${t.common.language}: ${next === "en" ? t.common.english : t.common.swahili}`}
      onClick={() => start(async () => { await api("/api/locale", { body: { locale: next } }); router.refresh(); })}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-white/5 px-3 text-xs font-bold text-muted ring-1 ring-line hover:text-fg", className)}
    >
      <Languages className="size-4" aria-hidden />
      <span className={cn(locale === "sw" && "text-gold-200")}>SW</span>
      <span className="text-subtle">/</span>
      <span className={cn(locale === "en" && "text-gold-200")}>EN</span>
    </button>
  );
}
