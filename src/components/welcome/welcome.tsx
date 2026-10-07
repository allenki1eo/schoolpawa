"use client";

import { ArrowRight, Plus, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/brand/avatar";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/app/language-toggle";
import { useI18n } from "@/components/providers/i18n";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client/api";
import { errorMessage, fmt } from "@/lib/i18n";
import { idb, idbAvailable } from "@/lib/offline/db";
import type { LocalProfile } from "@/lib/offline/types";

interface ServerProfile {
  id: string;
  nickname: string;
  avatar: string;
}

export function Welcome() {
  const { t } = useI18n();
  const router = useRouter();
  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [pending, setPending] = useState<LocalProfile[]>([]);
  const [selected, setSelected] = useState<ServerProfile | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ profiles: ServerProfile[] }>("/api/profiles").then((r) => r.ok && setProfiles(r.data.profiles));
    if (idbAvailable()) void idb.all<LocalProfile>("profiles").then(setPending).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected || pin.length !== 4) return;
    void api("/api/session/switch", { body: { studentId: selected.id, pin } }).then((r) => {
      if (r.ok) router.replace("/home");
      else {
        setPinError(errorMessage(t, r.error));
        setTimeout(() => setPin(""), 350);
      }
    });
  }, [pin, selected, router, t]);

  const hasProfiles = profiles.length + pending.length > 0;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden px-5 pt-6 pb-8">
      <HeroBackdrop />
      <header className="relative flex items-center justify-between">
        <Logo />
        <LanguageToggle />
      </header>

      <section className="relative mt-10 flex-1">
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gold-400/10 px-3 py-1 text-xs font-semibold text-gold-200 ring-1 ring-gold-400/25">
          <Sparkles className="size-3.5" aria-hidden /> Shinyanga · 2026
        </p>
        <h1 className="font-display text-[2.6rem] leading-[1.02] font-black tracking-tight text-balance">
          {t.welcome.hero.split(" ").slice(0, -1).join(" ")} <span className="text-gold-gradient">{t.welcome.hero.split(" ").slice(-1)}</span>
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">{t.welcome.sub}</p>

        <PodiumPreview />

        {hasProfiles ? (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted">{t.welcome.whoIsPlaying}</h2>
            <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
              {profiles.map((p) => (
                <button key={p.id} type="button" onClick={() => { setSelected(p); setPin(""); setPinError(null); }} className="surface flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl p-3 transition-transform active:scale-95">
                  <Avatar avatar={p.avatar} size={52} />
                  <span className="w-full truncate text-center text-sm font-semibold">{p.nickname}</span>
                </button>
              ))}
              {pending.map((p) => (
                <Link key={p.localId} href={`/onboarding?resume=${p.localId}`} className="surface flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl p-3 opacity-80">
                  <Avatar avatar={p.avatar} size={52} />
                  <span className="w-full truncate text-center text-sm font-semibold">{p.nickname}</span>
                  <span className="text-center text-[0.65rem] leading-tight text-gold-200">{t.welcome.pendingConsent}</span>
                </Link>
              ))}
              <Link href="/onboarding" className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-3 text-muted">
                <span className="grid size-[52px] place-items-center rounded-full bg-white/5">
                  <Plus className="size-6" aria-hidden />
                </span>
                <span className="text-center text-xs font-semibold">{t.welcome.addProfile}</span>
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <footer className="relative mt-8 space-y-4">
        {!hasProfiles ? (
          <Button variant="gold" size="lg" block onClick={() => router.push("/onboarding")}>
            {t.welcome.start} <ArrowRight className="size-5" aria-hidden />
          </Button>
        ) : null}
        <div className="flex items-center justify-center gap-4 text-xs text-subtle">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" aria-hidden /> {t.welcome.stats}</span>
        </div>
        <div className="flex items-center justify-center gap-5 text-sm">
          <Link href="/parent" className="font-semibold text-muted underline-offset-4 hover:underline">{t.welcome.parentLink}</Link>
          <Link href="/offline" className="inline-flex items-center gap-1 text-muted underline-offset-4 hover:underline"><WifiOff className="size-3.5" aria-hidden />{t.offline.title}</Link>
        </div>
      </footer>

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? fmt(t.welcome.enterPin, { name: selected.nickname }) : ""}>
        {selected ? (
          <div className="flex flex-col items-center gap-4 pb-2">
            <Avatar avatar={selected.avatar} size={64} ring />
            <PinPad value={pin} onChange={(v) => { setPin(v); setPinError(null); }} error={Boolean(pinError)} label={t.onboarding.pinTitle} />
            <p className="min-h-5 text-sm text-danger" role="alert">{pinError}</p>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
      <div className="absolute -top-24 -right-24 size-80 rounded-full bg-gold-400/10 blur-3xl" />
      <div className="absolute top-64 -left-32 size-80 rounded-full bg-sky-400/10 blur-3xl" />
      <svg className="absolute inset-x-0 top-0 h-full w-full opacity-[0.05]" viewBox="0 0 400 800" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0v32" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="400" height="800" fill="url(#grid)" />
      </svg>
    </div>
  );
}

/** Decorative mini-podium: sets the competitive tone before sign-up. */
function PodiumPreview() {
  const bars = [
    { h: 72, label: "2", tone: "from-slate-300/80 to-slate-400/30", avatar: "twiga" },
    { h: 100, label: "1", tone: "from-gold-200 to-gold-500/40", avatar: "simba" },
    { h: 56, label: "3", tone: "from-orange-300/80 to-orange-500/30", avatar: "tembo" },
  ];
  return (
    <div aria-hidden className="mt-10 flex items-end justify-center gap-3">
      {bars.map((b, i) => (
        <div key={b.label} className="flex w-20 flex-col items-center gap-2 motion-safe:animate-rise" style={{ animationDelay: `${i * 90}ms` }}>
          <Avatar avatar={b.avatar} size={b.label === "1" ? 52 : 42} ring={b.label === "1"} />
          <div className={`flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b ${b.tone} pt-2`} style={{ height: b.h }}>
            <span className="num font-display text-2xl font-black text-ink-950/80">{b.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
