"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api } from "@/lib/client/api";
import { errorMessage, fmt } from "@/lib/i18n";

export function ParentLogin() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [masked, setMasked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="surface mt-8 space-y-4 rounded-3xl p-5">
      <p className="text-sm text-muted">{t.parent.intro}</p>
      {!requestId ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const r = await api<{ requestId: string; maskedPhone: string }>("/api/parent/request", { body: { phone, locale } });
            setBusy(false);
            if (!r.ok) return setError(errorMessage(t, r.error));
            setRequestId(r.data.requestId);
            setMasked(r.data.maskedPhone);
          }}
        >
          <Label htmlFor="pphone">{t.parent.phone}</Label>
          <Input id="pphone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="gold" size="lg" block className="mt-4" loading={busy}>{t.parent.send}</Button>
        </form>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const r = await api("/api/parent/verify", { body: { requestId, code } });
            setBusy(false);
            if (!r.ok) return setError(errorMessage(t, r.error, r.details as Record<string, number>));
            router.refresh();
          }}
        >
          <p className="mb-3 text-sm text-muted">{fmt(t.onboarding.codeSentTo, { phone: masked })}</p>
          <Label htmlFor="pcode">{t.parent.code}</Label>
          <Input id="pcode" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="num text-center text-2xl font-bold tracking-[0.5em]" />
          <FieldError>{error}</FieldError>
          <Button type="submit" variant="gold" size="lg" block className="mt-4" loading={busy} disabled={code.length !== 6}>{t.parent.verify}</Button>
        </form>
      )}
    </div>
  );
}

export function DeleteChildButton({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      block
      loading={busy}
      onClick={async () => {
        if (!confirm(fmt(t.parent.deleteConfirm, { name }))) return;
        setBusy(true);
        const r = await api("/api/parent/delete", { body: { studentId: id } });
        setBusy(false);
        toast(r.ok ? t.parent.deleted : errorMessage(t, r.error), r.ok ? "success" : "error");
        router.refresh();
      }}
    >
      <Trash2 className="size-4" aria-hidden /> {t.parent.delete}
    </Button>
  );
}

export function ParentLogout() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Button variant="ghost" block onClick={async () => { await api("/api/parent/logout", { body: {} }); router.refresh(); }}>
      <LogOut className="size-4" aria-hidden /> {t.parent.signOut}
    </Button>
  );
}
