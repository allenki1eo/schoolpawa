"use client";

import { Clock, Swords, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Emblem } from "@/components/brand/emblem";
import { Countdown } from "@/components/game/countdown";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage } from "@/lib/i18n";

type G = { id: string; name: string; emblem: string } | null;
interface BattleRow {
  id: string;
  status: "pending" | "active" | "completed" | "declined" | "expired";
  mineIsChallenger: boolean;
  challenger: G;
  opponent: G;
  topic: { nameSw: string; nameEn: string } | null;
  endsAt: string | null;
  winnerGroupId: string | null;
  standing: { challenger: { score: number; active: number; members: number }; opponent: { score: number; active: number; members: number } } | null;
  final: { challenger: number; opponent: number } | null;
}

export function GroupBattles({ groupId, isCreator, battles, topics }: { groupId: string; isCreator: boolean; battles: BattleRow[]; topics: Array<{ id: string; name: string }> }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const respond = async (id: string, accept: boolean) => {
    const r = await api(`/api/battles/${id}/respond`, { body: { accept } });
    if (!r.ok) toast(errorMessage(t, r.error), "error");
    router.refresh();
  };

  return (
    <section>
      <SectionTitle
        action={
          isCreator ? (
            <Button size="sm" variant="gold" onClick={() => setOpen(true)}>
              <Swords className="size-4" aria-hidden /> {t.battles.new.split(" ")[0]}
            </Button>
          ) : null
        }
      >
        {t.battles.title}
      </SectionTitle>
      <p className="mb-3 text-xs text-subtle">{t.battles.rules}</p>
      {battles.length === 0 ? <p className="rounded-2xl bg-white/[0.03] p-4 text-center text-sm text-subtle ring-1 ring-line">{t.battles.none}</p> : null}
      <ul className="space-y-3">
        {battles.map((b) => {
          const mine = b.mineIsChallenger ? b.challenger : b.opponent;
          const theirs = b.mineIsChallenger ? b.opponent : b.challenger;
          const sMine = b.standing ? (b.mineIsChallenger ? b.standing.challenger.score : b.standing.opponent.score) : b.final ? (b.mineIsChallenger ? b.final.challenger : b.final.opponent) : 0;
          const sTheirs = b.standing ? (b.mineIsChallenger ? b.standing.opponent.score : b.standing.challenger.score) : b.final ? (b.mineIsChallenger ? b.final.opponent : b.final.challenger) : 0;
          const total = sMine + sTheirs || 1;
          const won = b.status === "completed" && b.winnerGroupId === groupId;
          const lost = b.status === "completed" && b.winnerGroupId && b.winnerGroupId !== groupId;
          const incoming = b.status === "pending" && !b.mineIsChallenger;
          return (
            <li key={b.id} className={cn("surface rounded-3xl p-4", b.status === "active" && "ring-1 ring-violet-400/40", won && "ring-1 ring-gold-400/50")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {mine ? <Emblem emblem={mine.emblem} size={36} /> : null}
                  <span className="truncate text-sm font-bold">{mine?.name}</span>
                </div>
                <span className="font-display shrink-0 text-xs font-black text-subtle">VS</span>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <span className="truncate text-right text-sm font-bold">{theirs?.name}</span>
                  {theirs ? <Emblem emblem={theirs.emblem} size={36} /> : null}
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-subtle">{b.topic ? (locale === "sw" ? b.topic.nameSw : b.topic.nameEn) : ""}</p>

              {b.status === "active" || b.status === "completed" ? (
                <>
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-ink-700" role="img" aria-label={`${sMine.toFixed(1)} – ${sTheirs.toFixed(1)}`}>
                    <span className="h-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-700" style={{ width: `${(sMine / total) * 100}%` }} />
                    <span className="h-full flex-1 bg-gradient-to-r from-violet-500/60 to-violet-400" />
                  </div>
                  <div className="num mt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-gold-200">{sMine.toFixed(1)}</span>
                    <span className="text-[0.65rem] font-semibold text-subtle">{t.battles.perMember}</span>
                    <span className="text-violet-300">{sTheirs.toFixed(1)}</span>
                  </div>
                </>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {b.status === "active" && b.endsAt ? (
                  <Badge tone="info">
                    <Clock className="size-3.5" aria-hidden /> {t.battles.endsIn.split("{time}")[0]}
                    <Countdown to={b.endsAt} />
                  </Badge>
                ) : null}
                {won ? <Badge tone="gold"><Trophy className="size-3.5" aria-hidden />{t.battles.won}</Badge> : null}
                {lost ? <Badge tone="danger">{t.battles.lost}</Badge> : null}
                {b.status === "completed" && !b.winnerGroupId ? <Badge tone="info">{t.battles.draw}</Badge> : null}
                {b.status === "declined" ? <Badge>{t.battles.declined}</Badge> : null}
                {b.status === "expired" ? <Badge>{t.battles.expired}</Badge> : null}
                {b.status === "pending" && !incoming ? <Badge><Clock className="size-3.5" aria-hidden />{t.battles.pending}</Badge> : null}
              </div>

              {incoming && isCreator ? (
                <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
                  <Button variant="ghost" onClick={() => respond(b.id, false)}>{t.battles.decline}</Button>
                  <Button variant="gold" onClick={() => respond(b.id, true)}><Swords className="size-4" aria-hidden />{t.battles.accept}</Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title={t.battles.new}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bcode">{t.battles.opponentCode}</Label>
            <Input id="bcode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="XXXXXX" className="num tracking-[0.3em]" autoCapitalize="characters" />
          </div>
          <div>
            <Label>{t.battles.pickTopic}</Label>
            <div className="flex flex-wrap gap-2">
              {topics.map((tp) => (
                <button key={tp.id} type="button" onClick={() => setTopicId(tp.id)} aria-pressed={topicId === tp.id} className={cn("rounded-full px-3 py-2 text-sm font-semibold ring-1", topicId === tp.id ? "bg-gold-400/15 text-gold-200 ring-gold-400/40" : "bg-ink-850 text-muted ring-line")}>
                  {tp.name}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-subtle">{t.battles.rules}</p>
          <Button
            variant="gold"
            size="lg"
            block
            loading={busy}
            disabled={code.length !== 6 || !topicId}
            onClick={async () => {
              setBusy(true);
              const r = await api(`/api/groups/${groupId}/battles`, { body: { opponentCode: code, topicId } });
              setBusy(false);
              if (!r.ok) return toast(errorMessage(t, r.error), "error");
              toast(t.battles.sent, "success");
              setOpen(false);
              router.refresh();
            }}
          >
            <Swords className="size-5" aria-hidden /> {t.battles.send}
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
