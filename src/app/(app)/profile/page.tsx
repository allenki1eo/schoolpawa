import { Award, Flame, Gauge, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/brand/avatar";
import { Crest } from "@/components/brand/crest";
import { LanguageToggle } from "@/components/app/language-toggle";
import { ProfileActions } from "@/components/profile/profile-actions";
import { Badge } from "@/components/ui/badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/client/cn";
import { fmt } from "@/lib/i18n";
import { levelFor, LEVELS } from "@/lib/ranking/levels";
import { formatHandle } from "@/lib/safety/codes";
import { BADGES, earnedBadges } from "@/server/badges";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { studentContext } from "@/server/views";

export const metadata = { title: "Wasifu" };

export default async function ProfilePage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const [ctx, badges] = await Promise.all([studentContext(student), earnedBadges(student.id, student.streakDays)]);
  const level = levelFor(student.xp);
  const handle = formatHandle(student.nickname, student.discriminator);

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center text-center">
        <Avatar avatar={student.avatar} size={104} ring />
        <h1 className="font-display mt-4 text-3xl font-black">{student.nickname}</h1>
        <p className="num mt-1 rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-muted ring-1 ring-line">{handle}</p>
        <p className="mt-1 text-xs text-subtle">{t.profile.handleHint}</p>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Crest name={ctx.schoolName} regNo={ctx.regNo} color={ctx.regionColor} size={26} />
          {ctx.schoolName} · {locale === "sw" ? ctx.gradeSw : ctx.gradeEn}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<Star className="size-4" aria-hidden />} label={t.profile.totalXp} value={student.xp.toLocaleString("en-US")} gold />
        <Stat icon={<Gauge className="size-4" aria-hidden />} label={t.profile.rating} value={String(student.rating)} />
        <Stat icon={<Flame className="size-4" aria-hidden />} label={t.profile.streak} value={`${student.streakDays}`} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <Badge tone="gold">{t.levels[level.key]}</Badge>
          <span className="text-xs text-subtle">{level.next ? fmt(t.home.toNext, { n: level.xpToNext.toLocaleString("en-US"), level: t.levels[level.next] }) : t.home.maxLevel}</span>
        </div>
        <Progress value={level.progress} className="mt-3" label={t.home.level} />
        <ol className="mt-4 grid grid-cols-4 gap-2 text-center">
          {LEVELS.map((l, i) => (
            <li key={l.key} className={cn("rounded-xl px-1 py-2 text-[0.7rem] font-bold ring-1", i <= level.index ? "bg-gold-400/12 text-gold-200 ring-gold-400/30" : "text-subtle ring-line")}>
              {t.levels[l.key]}
              <span className="num block text-[0.6rem] font-medium opacity-70">{l.minXp.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
      </Card>

      <section>
        <SectionTitle>{t.badges.title}</SectionTitle>
        <ul className="grid grid-cols-4 gap-3">
          {BADGES.map((b) => {
            const earned = badges.has(b);
            return (
              <li key={b} className="flex flex-col items-center gap-1.5 text-center">
                <span className={cn("grid size-14 place-items-center rounded-2xl ring-1", earned ? "bg-gradient-to-b from-gold-200/30 to-gold-500/10 text-gold-400 ring-gold-400/40" : "bg-white/[0.03] text-ink-600 ring-line")}>
                  <Award className="size-7" aria-hidden />
                </span>
                <span className={cn("text-[0.65rem] leading-tight font-semibold", earned ? "text-fg" : "text-subtle")}>
                  {t.badges[b]}
                  <span className="sr-only">{earned ? " ✓" : ""}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{t.common.language}</span>
          <LanguageToggle />
        </div>
        <Link href="/offline" className="flex items-center justify-between font-semibold">
          {t.profile.offlinePacks}
          <span className="text-sm text-gold-200">{t.profile.playOffline} →</span>
        </Link>
      </Card>

      <Card className="flex gap-3">
        <ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">{t.profile.privacy}</p>
          <p className="mt-1 text-muted">{t.profile.privacyText}</p>
          <p className="mt-2 flex gap-4 text-xs">
            <Link href="/legal/privacy" className="text-gold-200 underline underline-offset-4">{t.legal.privacy}</Link>
            <Link href="/legal/terms" className="text-gold-200 underline underline-offset-4">{t.legal.terms}</Link>
          </p>
        </div>
      </Card>

      <ProfileActions />
    </div>
  );
}

function Stat({ icon, label, value, gold }: { icon: React.ReactNode; label: string; value: string; gold?: boolean }) {
  return (
    <div className="surface rounded-2xl p-3 text-center">
      <p className="flex items-center justify-center gap-1 text-[0.7rem] text-subtle">{icon}{label}</p>
      <p className={cn("num font-display mt-1 text-xl font-black", gold && "text-gold-gradient")}>{value}</p>
    </div>
  );
}
