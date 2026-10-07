"use client";

import { ArrowLeft, Ban, Crown, Flag, Flame, LogOut, MoreHorizontal, Swords, UserMinus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/brand/avatar";
import { Emblem } from "@/components/brand/emblem";
import { RankBadge } from "@/components/brand/game";
import { ShareActions } from "@/components/app/share";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { api, haptic } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import { PRESET_MESSAGES, REACTIONS, REPORT_REASONS, type ReactionKey } from "@/lib/safety/presets";

interface Row { studentId: string; nickname: string; discriminator: number; avatar: string; score: number; rank: number }
interface Reaction { id: string; presetKey: string; createdAt: string; fromId: string; fromNickname: string; fromAvatar: string; toId: string | null }

export function GroupDetail({
  me,
  group,
  board,
  period,
  reactions,
  appUrl,
}: {
  me: string;
  group: { id: string; name: string; emblem: string; inviteCode: string; creatorId: string | null; streak: number };
  board: Row[];
  period: "weekly" | "all";
  reactions: Reaction[];
  appUrl: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [member, setMember] = useState<Row | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const isCreator = group.creatorId === me;
  const url = `${appUrl}/g/${group.inviteCode}`;
  const nameOf = (id: string | null) => board.find((b) => b.studentId === id)?.nickname;

  const cheer = async (presetKey: string) => {
    haptic(10);
    const r = await api(`/api/groups/${group.id}/react`, { body: { presetKey } });
    if (!r.ok) return toast(errorMessage(t, r.error), "error");
    router.refresh();
  };

  const memberAction = async (path: string, body: Record<string, unknown>, success: string) => {
    const r = await api(path, { body });
    setMember(null);
    setReportOpen(false);
    toast(r.ok ? success : errorMessage(t, r.error), r.ok ? "success" : "error");
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-6">
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
        <ArrowLeft className="size-4" aria-hidden /> {t.groups.title}
      </Link>

      <header className="flex items-center gap-4">
        <Emblem emblem={group.emblem} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl font-black">{group.name}</h1>
          <p className="num text-sm text-subtle">{fmt(t.groups.members, { n: board.length })}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-orange-300" title={t.groups.streakHint}>
            <Flame className={cn("size-4", group.streak > 0 && "motion-safe:animate-flame")} fill={group.streak > 0 ? "currentColor" : "none"} aria-hidden />
            {fmt(t.groups.streak, { n: group.streak })}
          </p>
        </div>
      </header>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted">{t.groups.inviteCode}</span>
          <span className="num font-display text-2xl font-black tracking-[0.25em] text-gold-200">{group.inviteCode}</span>
        </div>
        <ShareActions text={fmt(t.groups.shareText, { name: group.name, code: group.inviteCode, url })} url={url} />
      </Card>

      {/* Cheers: preset only */}
      <section>
        <SectionTitle>{t.groups.cheer}</SectionTitle>
        <div className="flex gap-2">
          {(Object.keys(REACTIONS) as ReactionKey[]).map((k) => (
            <button key={k} type="button" onClick={() => cheer(k)} aria-label={t.reactions[k]} className="grid size-12 flex-1 place-items-center rounded-2xl bg-ink-850 text-2xl ring-1 ring-line transition-transform active:scale-90">
              {REACTIONS[k]}
            </button>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {PRESET_MESSAGES.map((m) => (
            <button key={m} type="button" onClick={() => cheer(m)} className="shrink-0 rounded-full bg-ink-850 px-3 py-2 text-sm font-medium text-muted ring-1 ring-line active:scale-95">
              {t.presets[m]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">{t.groups.noChat}</p>
      </section>

      <section>
        <SectionTitle>{t.groups.leaderboard}</SectionTitle>
        <Segmented
          value={period}
          onChange={(v) => router.replace(`/groups/${group.id}?period=${v}`)}
          options={[{ value: "weekly", label: t.common.weekly }, { value: "all", label: t.common.allTime }]}
          className="mb-3"
        />
        <ol className="surface divide-y divide-line overflow-hidden rounded-3xl">
          {board.map((r) => (
            <li key={r.studentId} className={cn("flex items-center gap-3 px-3 py-2.5", r.studentId === me && "bg-gold-400/[0.06]")}>
              <RankBadge rank={r.rank} />
              <Avatar avatar={r.avatar} size={38} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-semibold">
                  {r.nickname}
                  {r.studentId === group.creatorId ? <Crown className="size-3.5 text-gold-400" aria-label={t.groups.founder} /> : null}
                </p>
                <p className="num text-xs text-subtle">#{String(r.discriminator).padStart(4, "0")}</p>
              </div>
              <span className="num font-bold">{r.score.toLocaleString("en-US")}</span>
              {r.studentId !== me ? (
                <button type="button" onClick={() => setMember(r)} aria-label="Actions" className="grid size-9 place-items-center rounded-full text-subtle hover:bg-white/5">
                  <MoreHorizontal className="size-5" aria-hidden />
                </button>
              ) : <span className="size-9" />}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>{t.groups.activity}</SectionTitle>
        {reactions.length === 0 ? <p className="text-sm text-subtle">{t.groups.noActivity}</p> : null}
        <ul className="space-y-2">
          {reactions.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2 ring-1 ring-line">
              <Avatar avatar={r.fromAvatar} size={30} />
              <p className="flex-1 text-sm">
                <span className="font-semibold">{r.fromNickname}</span>
                {r.toId ? <span className="text-subtle"> → {nameOf(r.toId)}</span> : null}{" "}
                <span className="text-muted">
                  {r.presetKey in REACTIONS ? REACTIONS[r.presetKey as ReactionKey] : t.presets[r.presetKey as keyof typeof t.presets]}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Button
        variant="danger"
        block
        onClick={async () => {
          if (!confirm(t.groups.leave + "?")) return;
          const r = await api(`/api/groups/${group.id}/leave`, { body: {} });
          if (r.ok) router.replace("/groups");
        }}
      >
        <LogOut className="size-4" aria-hidden /> {t.groups.leave}
      </Button>

      <Sheet open={Boolean(member) && !reportOpen} onClose={() => setMember(null)} title={member?.nickname ?? ""}>
        {member ? (
          <div className="grid gap-2">
            <Button variant="gold" block onClick={() => router.push(`/challenges?new=1&opponent=${member.studentId}&group=${group.id}`)}>
              <Swords className="size-4" aria-hidden /> {t.groups.challengeMember}
            </Button>
            {isCreator ? (
              <Button block onClick={() => memberAction(`/api/groups/${group.id}/remove`, { memberId: member.studentId }, t.common.done)}>
                <UserMinus className="size-4" aria-hidden /> {t.groups.remove}
              </Button>
            ) : null}
            <Button block onClick={() => setReportOpen(true)}>
              <Flag className="size-4" aria-hidden /> {t.common.report}
            </Button>
            <Button variant="danger" block onClick={() => memberAction("/api/block", { studentId: member.studentId }, t.common.blocked)}>
              <Ban className="size-4" aria-hidden /> {t.common.block}
            </Button>
          </div>
        ) : null}
      </Sheet>
      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title={t.common.report}>
        <div className="grid gap-2">
          {REPORT_REASONS.map((reason) => (
            <Button key={reason} block onClick={() => member && memberAction("/api/report", { targetType: "student", targetId: member.studentId, reason }, t.common.reported)}>
              {t.reportReasons[reason]}
            </Button>
          ))}
          <Button variant="ghost" block onClick={() => memberAction("/api/report", { targetType: "group", targetId: group.id, reason: "bad_name" }, t.common.reported)}>
            {t.common.report}: {group.name}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
