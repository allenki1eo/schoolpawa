"use client";

import { Check, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { errorMessage } from "@/lib/i18n";
import { idb, idbAvailable } from "@/lib/offline/db";
import type { PackQuestion, StoredPack } from "@/lib/offline/types";

export function DownloadPackButton({ topicId, topicName, accent, studentId }: { topicId: string; topicName: string; accent: string; studentId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!idbAvailable()) return;
    void idb.all<StoredPack>("packs").then((packs) => setSaved(packs.some((p) => p.topicId === topicId && p.studentId === studentId && !p.played)));
  }, [topicId, studentId]);

  return (
    <button
      type="button"
      disabled={busy || saved || !idbAvailable()}
      onClick={async () => {
        setBusy(true);
        const r = await api<{ packId: string; issuedAt: string; questions: PackQuestion[] }>(`/api/packs/${topicId}`);
        setBusy(false);
        if (!r.ok) return toast(errorMessage(t, r.error), "error");
        await idb.put<StoredPack>("packs", {
          key: r.data.packId,
          packId: r.data.packId,
          studentId,
          topicId,
          topicName,
          accent,
          issuedAt: r.data.issuedAt,
          questions: r.data.questions,
        });
        setSaved(true);
        toast(t.learn.downloaded, "success");
      }}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold ring-1 transition-colors",
        saved ? "bg-success/10 text-success ring-success/30" : "bg-ink-800 ring-line-strong",
      )}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : saved ? <Check className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
      <span className="truncate">{saved ? t.learn.downloaded : t.learn.downloadShort}</span>
    </button>
  );
}
