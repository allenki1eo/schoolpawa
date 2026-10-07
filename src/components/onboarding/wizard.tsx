"use client";

import { ArrowLeft, Check, ChevronRight, Lock, MapPin, MessageSquareText, School, Search, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/brand/avatar";
import { Crest } from "@/components/brand/crest";
import { useI18n } from "@/components/providers/i18n";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { PinPad } from "@/components/ui/pin-pad";
import { Progress } from "@/components/ui/progress";
import { api, haptic } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import { idb, idbAvailable } from "@/lib/offline/db";
import { hashPinLocal } from "@/lib/offline/pin";
import type { LocalProfile } from "@/lib/offline/types";
import { checkName, NICKNAME_RULES } from "@/lib/safety/profanity";
import { AVATARS } from "@/lib/safety/presets";

type Step = "region" | "district" | "school" | "class" | "nickname" | "pin" | "parent" | "consent" | "done";
const FLOW: Step[] = ["region", "district", "school", "class", "nickname", "pin", "parent", "consent"];

interface Region { id: string; name: string; color: string }
interface District { id: string; name: string }
interface SchoolOpt { id: string; name: string; regNo: string; stage: "primary" | "secondary" }
interface Grade { id: string; labelSw: string; labelEn: string; active: boolean }

export function OnboardingWizard() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("region");

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [schools, setSchools] = useState<SchoolOpt[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  const [region, setRegion] = useState<Region | null>(null);
  const [district, setDistrict] = useState<District | null>(null);
  const [school, setSchool] = useState<SchoolOpt | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>("simba");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pinStage, setPinStage] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [masked, setMasked] = useState("");
  const [code, setCode] = useState("");
  const [localId, setLocalId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("");

  // Resume a profile that was created on this device but is still awaiting consent.
  useEffect(() => {
    const resume = params.get("resume");
    if (!resume || !idbAvailable()) return;
    void idb.get<LocalProfile>("profiles", resume).then((p) => {
      if (!p) return;
      setLocalId(p.localId);
      setNickname(p.nickname);
      setAvatar(p.avatar);
      setSchool({ id: p.schoolId, name: p.schoolName, regNo: "", stage: p.gradeLevelId.startsWith("std") ? "primary" : "secondary" });
      setGrade({ id: p.gradeLevelId, labelSw: "", labelEn: "", active: true });
      // The PIN exists only as a local hash, so the child re-enters it before consent.
      setStep("pin");
    });
  }, [params]);

  useEffect(() => {
    void api<{ regions: Region[] }>("/api/onboarding/options").then((r) => r.ok && setRegions(r.data.regions));
  }, []);
  useEffect(() => {
    if (!region) return;
    void api<{ districts: District[] }>(`/api/onboarding/options?region=${region.id}`).then((r) => r.ok && setDistricts(r.data.districts));
  }, [region]);
  useEffect(() => {
    if (!district) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void api<{ schools: SchoolOpt[] }>(`/api/onboarding/options?district=${district.id}&q=${encodeURIComponent(query)}`, { signal: ctrl.signal }).then(
        (r) => r.ok && setSchools(r.data.schools),
      );
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [district, query]);
  useEffect(() => {
    if (!school) return;
    void api<{ grades: Grade[] }>(`/api/onboarding/options?stage=${school.stage}`).then((r) => r.ok && setGrades(r.data.grades));
  }, [school]);

  const nameCheck = useMemo(() => checkName(nickname, NICKNAME_RULES), [nickname]);
  const stepIndex = Math.max(0, FLOW.indexOf(step));

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    haptic(6);
  };
  const back = () => {
    if (step === "consent") return go("parent");
    const i = FLOW.indexOf(step);
    if (i <= 0) return router.push("/");
    if (step === "pin") {
      setPin("");
      setPin2("");
      setPinStage(1);
    }
    go(FLOW[i - 1]!);
  };

  /** Store the profile ON THIS DEVICE ONLY until a parent consents. */
  async function saveLocalProfile() {
    if (!school || !grade) return;
    const { hash, salt } = await hashPinLocal(pin);
    const id = localId ?? crypto.randomUUID();
    setLocalId(id);
    if (idbAvailable()) {
      await idb.put<LocalProfile>("profiles", {
        localId: id,
        nickname: nameCheck.value,
        avatar,
        schoolId: school.id,
        schoolName: school.name,
        gradeLevelId: grade.id,
        pinHash: hash,
        pinSalt: salt,
        createdAt: new Date().toISOString(),
      });
    }
    go("parent");
  }

  // PIN: enter, then confirm (handled on input, not in an effect).
  function onPinChange(v: string) {
    setError(null);
    if (pinStage === 1) {
      setPin(v);
      // Switch immediately so fast typists don't lose the first confirm digit.
      if (v.length === 4) setPinStage(2);
      return;
    }
    setPin2(v);
    if (v.length !== 4) return;
    if (v !== pin) {
      setError(t.onboarding.pinMismatch);
      setTimeout(() => {
        setPin("");
        setPin2("");
        setPinStage(1);
      }, 600);
    } else void saveLocalProfile();
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    const r = await api<{ requestId: string; maskedPhone: string }>("/api/consent/request", { body: { phone, locale } });
    setBusy(false);
    if (!r.ok) return setError(errorMessage(t, r.error));
    setRequestId(r.data.requestId);
    setMasked(r.data.maskedPhone);
    setCode("");
    go("consent");
  }

  async function confirm() {
    if (!requestId || !school || !grade) return;
    if (pin.length !== 4) {
      // Resumed profile: the PIN lives only as a local hash, so ask again.
      setError(t.onboarding.pinHint);
      return go("pin");
    }
    setBusy(true);
    setError(null);
    const r = await api<{ nickname: string }>("/api/consent/confirm", {
      body: { requestId, code, locale, profile: { nickname: nameCheck.value || nickname, avatar, schoolId: school.id, gradeLevelId: grade.id, pin } },
    });
    setBusy(false);
    if (!r.ok) {
      const problem = typeof r.details?.problem === "string" ? r.details.problem : undefined;
      if (r.error === "nickname_rejected" && problem) return setError((t.nameProblems as Record<string, string>)[problem] ?? errorMessage(t, r.error));
      return setError(errorMessage(t, r.error, r.details as Record<string, number>));
    }
    if (localId && idbAvailable()) await idb.del("profiles", localId);
    haptic([20, 40, 20]);
    setWelcomeName(r.data.nickname);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6">
          <span aria-hidden className="absolute inset-0 rounded-full bg-gold-400/40 motion-safe:animate-burst" />
          <Avatar avatar={avatar} size={112} ring />
        </div>
        <h1 className="font-display text-3xl font-black">{fmt(t.onboarding.welcomeTitle, { name: welcomeName })}</h1>
        <p className="mt-3 max-w-xs text-muted">{fmt(t.onboarding.welcomeSub, { school: school?.name ?? "" })}</p>
        {school?.regNo ? (
          <div className="mt-6">
            <Crest name={school.name} regNo={school.regNo} color={region?.color ?? "#2dd4bf"} size={64} glow />
          </div>
        ) : null}
        <Button variant="gold" size="lg" block className="mt-10" onClick={() => router.replace("/home")}>
          {t.onboarding.firstQuiz} <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pt-4 pb-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label={t.common.back} className="grid size-10 place-items-center rounded-full bg-white/5 ring-1 ring-line">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <Progress value={(stepIndex + 1) / FLOW.length} className="flex-1" label={fmt(t.onboarding.progress, { step: stepIndex + 1, total: FLOW.length })} />
        <span className="num text-xs font-semibold text-subtle">
          {stepIndex + 1}/{FLOW.length}
        </span>
      </div>

      <div key={step} className="mt-8 flex flex-1 flex-col motion-safe:animate-rise">
        {step === "region" && (
          <StepShell icon={<MapPin />} title={t.onboarding.regionTitle}>
            <OptionList
              items={regions.map((r) => ({ id: r.id, label: r.name, dot: r.color }))}
              selected={region?.id}
              onPick={(id) => {
                const r = regions.find((x) => x.id === id)!;
                setRegion(r);
                setDistrict(null);
                setSchool(null);
                go("district");
              }}
            />
          </StepShell>
        )}

        {step === "district" && (
          <StepShell icon={<MapPin />} title={t.onboarding.districtTitle}>
            <OptionList
              items={districts.map((d) => ({ id: d.id, label: d.name }))}
              selected={district?.id}
              onPick={(id) => {
                setDistrict(districts.find((x) => x.id === id)!);
                setSchool(null);
                setQuery("");
                go("school");
              }}
            />
          </StepShell>
        )}

        {step === "school" && (
          <StepShell icon={<School />} title={t.onboarding.schoolTitle}>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.onboarding.schoolSearch} className="pl-12" aria-label={t.common.search} autoFocus />
            </div>
            {schools.length === 0 ? <p className="py-8 text-center text-sm text-subtle">{t.onboarding.schoolEmpty}</p> : null}
            <ul className="space-y-2">
              {schools.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSchool(s);
                      setGrade(null);
                      go("class");
                    }}
                    className={cn("surface flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-transform active:scale-[0.98]", school?.id === s.id && "ring-2 ring-gold-400")}
                  >
                    <Crest name={s.name} regNo={s.regNo} color={region?.color ?? "#2dd4bf"} size={36} />
                    <span className="flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="text-xs text-subtle">{s.stage === "primary" ? "Msingi · Primary" : "Sekondari · Secondary"}</span>
                    </span>
                    <ChevronRight className="size-5 text-subtle" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </StepShell>
        )}

        {step === "class" && (
          <StepShell icon={<School />} title={t.onboarding.classTitle}>
            <div className="grid grid-cols-2 gap-3">
              {grades.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGrade(g);
                    go("nickname");
                  }}
                  className={cn("surface h-20 rounded-2xl text-lg font-bold transition-transform active:scale-95", grade?.id === g.id && "ring-2 ring-gold-400")}
                >
                  {locale === "sw" ? g.labelSw : g.labelEn}
                </button>
              ))}
            </div>
          </StepShell>
        )}

        {step === "nickname" && (
          <StepShell title={t.onboarding.nicknameTitle} subtitle={t.onboarding.nicknameHint}>
            <div className="mb-6 flex justify-center">
              <Avatar avatar={avatar} size={96} ring />
            </div>
            <Label htmlFor="nick">{t.onboarding.nicknameLabel}</Label>
            <Input
              id="nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_RULES.max + 4}
              autoComplete="off"
              autoCapitalize="words"
              invalid={nickname.length > 0 && !nameCheck.ok}
              placeholder="Simba Mkali"
            />
            <FieldError>{nickname.length > 0 && !nameCheck.ok && nameCheck.problem ? t.nameProblems[nameCheck.problem] : null}</FieldError>

            <p className="mt-6 mb-3 text-sm font-medium text-muted">{t.onboarding.avatarLabel}</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => {
                    setAvatar(a);
                    haptic(6);
                  }}
                  aria-pressed={avatar === a}
                  aria-label={t.avatars[a]}
                  className={cn("grid place-items-center rounded-2xl p-1 transition-transform active:scale-90", avatar === a ? "bg-gold-400/15 ring-2 ring-gold-400" : "ring-1 ring-transparent")}
                >
                  <Avatar avatar={a} size={44} label={t.avatars[a]} />
                </button>
              ))}
            </div>
            <div className="mt-auto pt-8">
              <Button variant="gold" size="lg" block disabled={!nameCheck.ok} onClick={() => go("pin")}>
                {t.common.continue}
              </Button>
            </div>
          </StepShell>
        )}

        {step === "pin" && (
          <StepShell icon={<Lock />} title={pinStage === 1 ? t.onboarding.pinTitle : t.onboarding.pinConfirm} subtitle={t.onboarding.pinHint}>
            <div className="mt-4">
              <PinPad
                value={pinStage === 1 ? pin : pin2}
                onChange={onPinChange}
                error={Boolean(error)}
                label={t.onboarding.pinTitle}
              />
              <p role="alert" className="mt-4 min-h-5 text-center text-sm text-danger">{error}</p>
            </div>
          </StepShell>
        )}

        {step === "parent" && (
          <StepShell icon={<Smartphone />} title={t.onboarding.parentTitle} subtitle={t.onboarding.parentIntro}>
            <div className="surface mb-5 flex items-center gap-3 rounded-2xl p-3">
              <Avatar avatar={avatar} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{nameCheck.value || nickname}</p>
                <p className="truncate text-xs text-subtle">{school?.name}</p>
              </div>
            </div>
            <Label htmlFor="phone">{t.onboarding.parentPhone}</Label>
            <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
            <FieldError>{error}</FieldError>
            <div className="mt-auto space-y-3 pt-8">
              <Button variant="gold" size="lg" block loading={busy} disabled={phone.replace(/\D/g, "").length < 9} onClick={sendCode}>
                <MessageSquareText className="size-5" aria-hidden /> {t.onboarding.sendCode}
              </Button>
              {grade ? (
                <Link href={`/offline?starter=${grade.id}`} className="block text-center text-sm font-semibold text-muted underline-offset-4 hover:underline">
                  {t.onboarding.practiceWhileWaiting}
                </Link>
              ) : null}
            </div>
          </StepShell>
        )}

        {step === "consent" && (
          <StepShell icon={<ShieldCheck />} title={t.onboarding.consentTitle}>
            <div className="surface space-y-3 rounded-2xl p-4 text-sm leading-relaxed">
              <p className="font-semibold text-fg">{t.onboarding.consentWhat}</p>
              <p className="flex items-start gap-2 text-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {t.onboarding.consentItems}
              </p>
              <p className="text-muted">{t.onboarding.consentNever}</p>
              <p className="text-muted">{t.onboarding.consentRights}</p>
              <Link href="/legal/privacy" target="_blank" className="inline-block font-semibold text-gold-200 underline underline-offset-4">
                {t.onboarding.consentPolicy}
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">{fmt(t.onboarding.codeSentTo, { phone: masked })}</p>
            <Label htmlFor="code" className="mt-3">{t.onboarding.codeLabel}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="num text-center text-2xl font-bold tracking-[0.5em]"
              placeholder="••••••"
            />
            <FieldError>{error}</FieldError>
            <div className="mt-auto space-y-3 pt-8">
              <Button variant="gold" size="lg" block loading={busy} disabled={code.length !== 6} onClick={confirm}>
                {t.onboarding.agree}
              </Button>
              <button type="button" onClick={sendCode} disabled={busy} className="w-full text-center text-sm font-semibold text-muted">
                {t.onboarding.resend}
              </button>
            </div>
          </StepShell>
        )}
      </div>
    </div>
  );
}

function StepShell({ icon, title, subtitle, children }: { icon?: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-1 flex-col">
      {icon ? <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-gold-400/12 text-gold-400 ring-1 ring-gold-400/25 [&>svg]:size-6">{icon}</span> : null}
      <h1 className="font-display text-[1.75rem] leading-tight font-extrabold text-balance">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p> : null}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function OptionList({ items, selected, onPick }: { items: Array<{ id: string; label: string; dot?: string }>; selected?: string; onPick: (id: string) => void }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => onPick(it.id)}
            className={cn("surface flex h-16 w-full items-center gap-3 rounded-2xl px-4 text-left font-semibold transition-transform active:scale-[0.98]", selected === it.id && "ring-2 ring-gold-400")}
          >
            {it.dot ? <span aria-hidden className="size-3 rounded-full" style={{ background: it.dot, boxShadow: `0 0 12px ${it.dot}` }} /> : null}
            <span className="flex-1">{it.label}</span>
            <ChevronRight className="size-5 text-subtle" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
