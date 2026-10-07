"use client";

import { Clock, Link2, Play, Plus, Swords, Trophy, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/brand/avatar";
import { ShareActions } from "@/components/app/share";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import { CHALLENGE_DRAW_BONUS, CHALLENGE_WIN_BONUS } from "@/lib/quiz/scoring";
import { PRESET_MESSAGES } from "@/lib/safety/presets";

type Person = { id: string; nickname: string; discriminator: number; avatar: string };
export interface ChallengeRow {
  id: string;
  code: string;
  status: "open" | "completed" | "expired" | "declined";
  iAmChallenger: boolean;
  topic: { sw: string; en: string };
  challenger: Person;
  opponent: Person | null;
  presetMessage: string | null;
  myScore: number | null;
  theirScore: number | null;
  iHavePlayed: boolean;
  winnerId: string | null;
  expiresAt: string;
}
interface TopicOpt { id: string; name: string; subject: string; accent: string }

export function ChallengesView({
  me,
  challenges,
  topics,
  appUrl,
  openNew,
  initialTopic,
  initialOpponent,
  groupId,
}: {
  me: string;
  challenges: ChallengeRow[];
  topics: TopicOpt[];
  appUrl: string;
  openNew: boolean;
  initialTopic?: string;
  initialOpponent?: string;
  groupId?: string;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(openNew);
  const [topicId, setTopicId] = useState(initialTopic ?? topics[0]?.id ?? "");
  const [mode, setMode] = useState<"handle" | "link">(initialOpponent ? "handle" : "link");
  const [handle, setHandle] = useState("");
  const [preset, setPreset] = useState<string>("coming_for_you");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ code: string; sessionId: string } | null>(null);
  const [code, setCode] = useState("");

  const topicName = topics.find((x) => x.id === topicId)?.name ?? "";

  async function create() {
    setBusy(true);
    const r = await api<{ code: string; sessionId: string }>("/api/challenges", {
      body: {
        topicId,
        presetMessage: preset,
        groupId,
        ...(initialOpponent ? { opponentId: initialOpponent } : mode === "handle" ? { opponentHandle: handle } : {}),
      },
    });
    setBusy(false);
    if (!r.ok) return toast(errorMessage(t, r.error), "error");
    if (mode === "handle" || initialOpponent) router.push(`/play/${r.data.sessionId}`);
    else setCreated(r.data);
  }

  async function accept(c: string) {
    const r = await api<{ sessionId: string }>("/api/challenges/accept", { body: { code: c } });
    if (!r.ok) return toast(errorMessage(t, r.error), "error");
    router.push(`/play/${r.data.sessionId}`);
  }

  const active = challenges.filter((c) => c.status === "open");
  const done = challenges.filter((c) => c.status !== "open");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-black">{t.challenges.title}</h1>
        <Button variant="gold" size="sm" onClick={() => { setCreated(null); setOpen(true); }}>
          <Plus className="size-4" aria-hidden /> {t.challenges.newTitle}
        </Button>
      </div>

      <Card className="p-4">
        <Label htmlFor="code">{t.challenges.haveCode}</Label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void accept(code);
          }}
        >
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder={t.challenges.codePlaceholder} className="num h-12 tracking-[0.3em] uppercase" autoCapitalize="characters" />
          <Button type="submit" variant="primary" disabled={code.length !== 6}>
            {t.challenges.accept}
          </Button>
        </form>
      </Card>

      {challenges.length === 0 ? (
        <EmptyState icon={<Swords className="size-8" aria-hidden />} text={t.challenges.empty} />
      ) : null}

      {active.length > 0 ? (
        <ul className="space-y-3">
          {active.map((c) => (
            <ChallengeCard key={c.id} c={c} me={me} locale={locale} onAccept={() => accept(c.code)} onDecline={async () => { await api(`/api/challenges/${c.id}/decline`, { body: {} }); router.refresh(); }} />
          ))}
        </ul>
      ) : null}

      {done.length > 0 ? (
        <ul className="space-y-3">
          {done.map((c) => (
            <ChallengeCard key={c.id} c={c} me={me} locale={locale} />
          ))}
        </ul>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title={t.challenges.newTitle}>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-gold-400/10 p-5 text-center ring-1 ring-gold-400/30">
              <p className="text-sm font-semibold text-gold-200">{t.challenges.linkReady}</p>
              <p className="num font-display mt-2 text-4xl font-black tracking-[0.25em]">{created.code}</p>
            </div>
            <ShareActions text={fmt(t.challenges.shareText, { topic: topicName, url: `${appUrl}/c/${created.code}` })} url={`${appUrl}/c/${created.code}`} />
            <Button variant="gold" size="lg" block onClick={() => router.push(`/play/${created.sessionId}`)}>
              <Play className="size-5" fill="currentColor" aria-hidden /> {t.challenges.play}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <Label>{t.challenges.pickTopic}</Label>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {topics.map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setTopicId(tp.id)}
                    aria-pressed={topicId === tp.id}
                    className={cn("shrink-0 rounded-2xl px-4 py-3 text-left ring-1 transition-colors", topicId === tp.id ? "bg-white/8 ring-2" : "bg-ink-850 ring-line")}
                    style={topicId === tp.id ? { ["--tw-ring-color" as string]: tp.accent } : undefined}
                  >
                    <span className="block text-[0.65rem] font-bold uppercase" style={{ color: tp.accent }}>{tp.subject}</span>
                    <span className="text-sm font-semibold">{tp.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {!initialOpponent ? (
              <div>
                <Label>{t.challenges.pickOpponent}</Label>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "link", label: <span className="inline-flex items-center gap-1.5"><Link2 className="size-4" aria-hidden />{t.challenges.byLink}</span> },
                    { value: "handle", label: <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" aria-hidden />Simba#0000</span> },
                  ]}
                />
                {mode === "handle" ? (
                  <Input className="mt-3" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={t.challenges.byHandle} autoCapitalize="words" />
                ) : (
                  <p className="mt-2 text-xs text-subtle">{t.challenges.byLinkHint}</p>
                )}
              </div>
            ) : null}
            <div>
              <Label>{t.challenges.message}</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_MESSAGES.map((m) => (
                  <button key={m} type="button" onClick={() => setPreset(m)} aria-pressed={preset === m} className={cn("rounded-full px-3 py-2 text-sm font-medium ring-1", preset === m ? "bg-gold-400/15 text-gold-200 ring-gold-400/40" : "bg-ink-850 text-muted ring-line")}>
                    {t.presets[m]}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="gold" size="lg" block loading={busy} disabled={!topicId || (mode === "handle" && !initialOpponent && !handle.includes("#"))} onClick={create}>
              <Swords className="size-5" aria-hidden /> {t.challenges.send}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ChallengeCard({ c, me, locale, onAccept, onDecline }: { c: ChallengeRow; me: string; locale: "sw" | "en"; onAccept?: () => void; onDecline?: () => void }) {
  const { t } = useI18n();
  const them = c.iAmChallenger ? c.opponent : c.challenger;
  const won = c.status === "completed" && c.winnerId === me;
  const lost = c.status === "completed" && c.winnerId && c.winnerId !== me;
  const draw = c.status === "completed" && !c.winnerId;
  const myTurn = c.status === "open" && !c.iHavePlayed && !c.iAmChallenger;

  return (
    <li className={cn("surface rounded-3xl p-4", myTurn && "ring-2 ring-gold-400/60", won && "ring-1 ring-gold-400/40")}>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3">
          <Avatar avatar={c.challenger.avatar} size={40} className="ring-2 ring-ink-900" />
          {c.opponent ? <Avatar avatar={c.opponent.avatar} size={40} className="ring-2 ring-ink-900" /> : <span className="grid size-10 place-items-center rounded-full bg-ink-700 text-subtle ring-2 ring-ink-900">?</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {t.common.you} <span className="text-subtle">{t.challenges.vs}</span> {them ? `${them.nickname}` : "…"}
          </p>
          <p className="truncate text-xs text-subtle">{c.topic[locale]}</p>
        </div>
        {won ? <Badge tone="gold"><Trophy className="size-3.5" aria-hidden />{fmt(t.challenges.won, { n: CHALLENGE_WIN_BONUS })}</Badge> : null}
        {lost ? <Badge tone="danger">{t.challenges.lost}</Badge> : null}
        {draw ? <Badge tone="info">{t.challenges.draw} +{CHALLENGE_DRAW_BONUS}</Badge> : null}
        {c.status === "expired" ? <Badge>{t.challenges.expired}</Badge> : null}
        {c.status === "declined" ? <Badge>{t.challenges.declined}</Badge> : null}
        {c.status === "open" && c.iHavePlayed ? <Badge><Clock className="size-3.5" aria-hidden />{t.challenges.waitingForThem}</Badge> : null}
      </div>

      {c.myScore !== null ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-white/[0.04] py-2">
            <p className="text-[0.7rem] text-subtle">{t.common.you}</p>
            <p className={cn("num font-display text-2xl font-black", won && "text-gold-gradient")}>{c.myScore}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] py-2">
            <p className="truncate text-[0.7rem] text-subtle">{them?.nickname ?? "…"}</p>
            <p className={cn("num font-display text-2xl font-black", lost && "text-gold-gradient")}>{c.theirScore ?? "–"}</p>
          </div>
        </div>
      ) : null}

      {!c.iAmChallenger && c.presetMessage ? <p className="mt-3 rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-muted">“{t.presets[c.presetMessage as keyof typeof t.presets]}”</p> : null}

      {myTurn && onAccept ? (
        <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="ghost" onClick={onDecline}>{t.challenges.decline}</Button>
          <Button variant="gold" onClick={onAccept}><Play className="size-4" fill="currentColor" aria-hidden />{t.challenges.yourTurn}</Button>
        </div>
      ) : null}
    </li>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong px-6 py-10 text-center text-muted">
      <span className="grid size-16 place-items-center rounded-full bg-white/5 text-subtle">{icon}</span>
      <p className="max-w-xs text-sm">{text}</p>
    </div>
  );
}
