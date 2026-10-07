"use client";

import { ChevronRight, Flame, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/challenges/challenges-view";
import { Emblem } from "@/components/brand/emblem";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage, fmt } from "@/lib/i18n";
import { GROUP_EMBLEMS } from "@/lib/safety/presets";
import { checkName, GROUP_NAME_RULES } from "@/lib/safety/profanity";

interface GroupRow { id: string; name: string; emblem: string; members: number; streakDays: number }

export function GroupsView({ groups }: { groups: GroupRow[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emblem, setEmblem] = useState<string>("ngao");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useMemo(() => checkName(name, GROUP_NAME_RULES), [name]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-black">{t.groups.title}</h1>
        <Button variant="gold" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> {t.groups.createShort}
        </Button>
      </div>

      <Card className="p-4">
        <Label htmlFor="invite">{t.groups.inviteCode}</Label>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await api<{ id: string }>("/api/groups/join", { body: { code } });
            setBusy(false);
            if (!r.ok) return toast(errorMessage(t, r.error), "error");
            router.push(`/groups/${r.data.id}`);
          }}
        >
          <Input id="invite" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder={t.groups.invitePlaceholder} className="num h-12 tracking-[0.3em]" autoCapitalize="characters" />
          <Button type="submit" variant="primary" disabled={code.length !== 6} loading={busy}>{t.groups.join}</Button>
        </form>
        <p className="mt-2 text-xs text-subtle">{t.groups.limitInfo}</p>
      </Card>

      {groups.length === 0 ? <EmptyState icon={<Users className="size-8" aria-hidden />} text={t.groups.empty} /> : null}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/groups/${g.id}`} className="surface flex items-center gap-4 rounded-3xl p-4 transition-transform active:scale-[0.99]">
              <Emblem emblem={g.emblem} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.name}</p>
                <p className="num text-xs text-subtle">{fmt(t.groups.members, { n: g.members })}</p>
              </div>
              {g.streakDays > 0 ? (
                <span className="num inline-flex items-center gap-1 text-sm font-bold text-orange-300">
                  <Flame className="size-4" fill="currentColor" aria-hidden />{g.streakDays}
                </span>
              ) : null}
              <ChevronRight className="size-5 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-subtle">{t.groups.noChat}</p>

      <Sheet open={open} onClose={() => setOpen(false)} title={t.groups.create}>
        <div className="space-y-5">
          <div className="flex justify-center"><Emblem emblem={emblem} size={80} /></div>
          <div>
            <Label htmlFor="gname">{t.groups.name}</Label>
            <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} maxLength={28} invalid={name.length > 0 && !check.ok} />
            <FieldError>{name.length > 0 && !check.ok && check.problem ? t.nameProblems[check.problem] : null}</FieldError>
          </div>
          <div>
            <Label>{t.groups.emblem}</Label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_EMBLEMS.map((e) => (
                <button key={e} type="button" onClick={() => setEmblem(e)} aria-pressed={emblem === e} aria-label={t.emblems[e]} className={cn("grid place-items-center rounded-2xl p-2 ring-1", emblem === e ? "bg-white/8 ring-2 ring-gold-400" : "ring-transparent")}>
                  <Emblem emblem={e} size={44} />
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="gold"
            size="lg"
            block
            loading={busy}
            disabled={!check.ok}
            onClick={async () => {
              setBusy(true);
              const r = await api<{ id: string }>("/api/groups", { body: { name, emblem } });
              setBusy(false);
              if (!r.ok) return toast(errorMessage(t, r.error), "error");
              router.push(`/groups/${r.data.id}`);
            }}
          >
            {t.groups.create}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
