"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";
import { errorMessage } from "@/lib/i18n";

export function JoinButton({ code }: { code: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="gold"
      size="lg"
      block
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await api<{ id: string }>("/api/groups/join", { body: { code } });
        if (r.ok) router.replace(`/groups/${r.data.id}`);
        else {
          setBusy(false);
          toast(errorMessage(t, r.error), "error");
        }
      }}
    >
      <Users className="size-5" aria-hidden /> {t.groups.join}
    </Button>
  );
}
