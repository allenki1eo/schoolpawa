import { Bell } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/brand/avatar";
import { StreakFlame } from "@/components/brand/game";
import { LogoMark } from "@/components/brand/logo";

export function TopBar({ avatar, streak, xp, xpLabel, unread, inboxLabel }: { avatar: string; streak: number; xp: number; xpLabel: string; unread: number; inboxLabel: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href="/home" aria-label="School Pawa" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="font-display hidden text-base font-extrabold min-[380px]:inline">
            School <span className="text-gold-gradient">Pawa</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <StreakFlame days={streak} />
          <span className="num rounded-full bg-gold-400/12 px-2.5 py-1 text-sm font-bold text-gold-200 ring-1 ring-gold-400/25">
            {xp.toLocaleString("en-US")} <span className="text-[0.7rem] font-semibold text-gold-400/80">{xpLabel}</span>
          </span>
          <Link href="/inbox" aria-label={`${inboxLabel}${unread ? ` (${unread})` : ""}`} className="relative grid size-9 place-items-center rounded-full bg-white/5 ring-1 ring-line">
            <Bell className="size-[1.1rem] text-muted" aria-hidden />
            {unread > 0 ? (
              <span className="num absolute -top-1 -right-1 grid min-w-[1.1rem] place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-black text-white ring-2 ring-ink-950">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link href="/profile" aria-label="Profile">
            <Avatar avatar={avatar} size={34} />
          </Link>
        </div>
      </div>
    </header>
  );
}
