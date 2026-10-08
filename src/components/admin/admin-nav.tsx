"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/questions", label: "Content" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/compliance", label: "Compliance" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap", active ? "bg-white/8 text-fg" : "text-subtle hover:text-muted")}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
