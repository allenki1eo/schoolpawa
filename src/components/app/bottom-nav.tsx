"use client";

import { BookOpen, Home, Swords, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/i18n";
import { cn } from "@/lib/client/cn";

export function BottomNav({ challengeBadge = 0 }: { challengeBadge?: number }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = [
    { href: "/home", label: t.nav.home, Icon: Home },
    { href: "/learn", label: t.nav.learn, Icon: BookOpen },
    { href: "/challenges", label: t.nav.challenges, Icon: Swords, badge: challengeBadge },
    { href: "/groups", label: t.nav.groups, Icon: Users },
    { href: "/rankings", label: t.nav.rankings, Icon: Trophy },
  ];
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink-950/90 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold transition-colors", active ? "text-gold-400" : "text-subtle hover:text-muted")}
              >
                {active ? <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-gold-400 shadow-[0_0_12px_var(--color-gold-400)]" /> : null}
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {badge ? (
                    <span className="num absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-black text-white">{badge}</span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
