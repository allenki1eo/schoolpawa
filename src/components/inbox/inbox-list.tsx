"use client";

import { Bell, Sparkles, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "@/components/brand/avatar";
import { Emblem } from "@/components/brand/emblem";
import { useI18n } from "@/components/providers/i18n";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";

interface Item {
  id: string;
  kind: string;
  payload: Record<string, string | number | null>;
  read: boolean;
  createdAt: string;
  from: { nickname: string; avatar: string } | null;
  group: { id: string; name: string; emblem: string } | null;
  otherGroup: { id: string; name: string; emblem: string } | null;
  topic: { nameSw: string; nameEn: string } | null;
}

function ago(iso: string, locale: "sw" | "en") {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale === "sw" ? "sw" : "en", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  if (mins < 1440) return rtf.format(-Math.round(mins / 60), "hour");
  return rtf.format(-Math.round(mins / 1440), "day");
}

export function InboxList({ me, items }: { me: string; items: Item[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const hasUnread = items.some((i) => !i.read);

  // Opening the inbox marks everything read (the badge clears on next navigation).
  useEffect(() => {
    if (hasUnread) void api("/api/notifications", { body: {} }).then(() => router.refresh());
  }, [hasUnread, router]);

  const describe = (i: Item) => {
    const name = i.from?.nickname ?? "…";
    const topic = i.topic ? (locale === "sw" ? i.topic.nameSw : i.topic.nameEn) : "";
    const myGroupWon = i.payload.winnerGroupId && (i.payload.winnerGroupId === i.group?.id || i.payload.winnerGroupId === i.otherGroup?.id);
    switch (i.kind) {
      case "challenge_received":
        return { text: fmt(t.inbox.challenge_received, { name, topic }), href: "/challenges", icon: <Swords className="size-4" /> };
      case "challenge_result": {
        const key = !i.payload.winnerId ? "challenge_draw" : i.payload.winnerId === me ? "challenge_won" : "challenge_lost";
        return { text: fmt(t.inbox[key], { name }), href: "/challenges", icon: <Trophy className="size-4" /> };
      }
      case "level_up":
        return { text: fmt(t.inbox.level_up, { level: t.levels[i.payload.level as keyof typeof t.levels] ?? "" }), href: "/profile", icon: <Sparkles className="size-4" /> };
      case "battle_invite":
        return { text: fmt(t.inbox.battle_invite, { group: i.group?.name ?? "…" }), href: i.otherGroup ? `/groups/${i.otherGroup.id}` : "/groups", icon: <Users className="size-4" /> };
      case "battle_started":
        return { text: fmt(t.inbox.battle_started, { group: i.group?.name ?? "…", other: i.otherGroup?.name ?? "…" }), href: "/groups", icon: <Users className="size-4" /> };
      case "battle_result":
        return { text: !i.payload.winnerGroupId ? t.inbox.battle_draw : myGroupWon ? t.inbox.battle_won : t.inbox.battle_lost, href: "/groups", icon: <Trophy className="size-4" /> };
      default:
        return { text: t.inbox.quest_ready, href: "/home", icon: <Bell className="size-4" /> };
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-black">{t.inbox.title}</h1>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line-strong px-6 py-12 text-center text-muted">
          <Bell className="size-8 text-subtle" aria-hidden />
          <p className="text-sm">{t.inbox.empty}</p>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((i) => {
          const d = describe(i);
          return (
            <li key={i.id}>
              <Link href={d.href} className={cn("surface flex items-center gap-3 rounded-2xl p-3", !i.read && "ring-1 ring-gold-400/40")}>
                {i.from ? <Avatar avatar={i.from.avatar} size={40} /> : i.group ? <Emblem emblem={i.group.emblem} size={40} /> : (
                  <span className="grid size-10 place-items-center rounded-full bg-gold-400/15 text-gold-300">{d.icon}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-semibold">{d.text}</p>
                  <p className="text-[0.7rem] text-subtle">{ago(i.createdAt, locale)}</p>
                </div>
                {!i.read ? <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-gold-400" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
