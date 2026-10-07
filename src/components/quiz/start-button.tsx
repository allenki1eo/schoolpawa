"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button, type ButtonProps } from "@/components/ui/button";
import { api, haptic } from "@/lib/client/api";
import { errorMessage } from "@/lib/i18n";

export function StartQuizButton({ topicId, kind = "practice", children, ...props }: { topicId: string; kind?: "practice" | "daily" } & ButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      {...props}
      loading={busy}
      onClick={async () => {
        haptic(10);
        setBusy(true);
        const r = await api<{ sessionId: string }>("/api/quiz/start", { body: { topicId, kind } });
        if (r.ok) router.push(`/play/${r.data.sessionId}`);
        else {
          setBusy(false);
          toast(errorMessage(t, r.error), "error");
        }
      }}
    >
      {children}
    </Button>
  );
}
