import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/brand/avatar";
import { LanguageToggle } from "@/components/app/language-toggle";
import { DeleteChildButton, ParentLogin, ParentLogout } from "@/components/parent/parent-client";
import { fmt } from "@/lib/i18n";
import { getDict } from "@/server/locale";
import { currentGuardianId } from "@/server/parent-session";
import { guardianChildren } from "@/server/privacy";

export const metadata = { title: "Mzazi" };

export default async function ParentPage() {
  const { t, locale } = await getDict();
  const guardianId = await currentGuardianId();
  const children = guardianId ? await guardianChildren(guardianId) : [];
  const date = (d: Date) => d.toLocaleDateString(locale === "sw" ? "sw-TZ" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-5 pt-5 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <ArrowLeft className="size-4" aria-hidden /> School Pawa
        </Link>
        <LanguageToggle />
      </div>
      <h1 className="font-display mt-6 flex items-center gap-2 text-3xl font-black">
        <ShieldCheck className="size-7 text-success" aria-hidden /> {t.parent.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t.parent.rights}</p>

      {!guardianId ? (
        <ParentLogin />
      ) : (
        <section className="mt-8 space-y-4">
          <h2 className="font-display text-lg font-bold">{t.parent.children}</h2>
          {children.length === 0 ? <p className="text-sm text-subtle">{t.parent.noChildren}</p> : null}
          {children.map((c) => (
            <article key={c.id} className="surface rounded-3xl p-4">
              <div className="flex items-center gap-3">
                <Avatar avatar={c.avatar} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{c.nickname}#{String(c.discriminator).padStart(4, "0")}</p>
                  <p className="truncate text-xs text-subtle">{c.schoolName}</p>
                  <p className="text-xs text-subtle">
                    {fmt(t.parent.joined, { date: date(c.createdAt) })} · {fmt(t.parent.lastSeen, { date: date(c.lastSeenAt) })}
                  </p>
                </div>
                <span className="num text-sm font-bold text-gold-200">{c.xp} XP</span>
              </div>
              <div className="mt-4 grid gap-2">
                <a href={`/api/parent/export/${c.id}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-800 text-sm font-semibold ring-1 ring-line-strong">
                  <Download className="size-4" aria-hidden /> {t.parent.export}
                </a>
                <DeleteChildButton id={c.id} name={c.nickname} />
              </div>
            </article>
          ))}
          <ParentLogout />
        </section>
      )}
      <p className="mt-10 flex justify-center gap-4 text-xs">
        <Link href="/legal/privacy" className="text-gold-200 underline underline-offset-4">{t.legal.privacy}</Link>
        <Link href="/legal/terms" className="text-gold-200 underline underline-offset-4">{t.legal.terms}</Link>
      </p>
    </div>
  );
}
