"use client";

import { Copy, Share2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n";
import { useToast } from "@/components/providers/toast";
import { Button } from "@/components/ui/button";

/** WhatsApp is how links travel in Tanzania: native share sheet first, WhatsApp deep link second. */
export function ShareActions({ text, url }: { text: string; url: string }) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (navigator.share) {
            e.preventDefault();
            void navigator.share({ text, url }).catch(() => {});
          }
        }}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-semibold text-ink-950"
      >
        <Share2 className="size-4" aria-hidden /> WhatsApp · {t.common.share}
      </a>
      <Button
        size="icon"
        className="size-12"
        aria-label={t.common.copy}
        onClick={async () => {
          await navigator.clipboard?.writeText(url).catch(() => {});
          toast(t.common.copied, "success");
        }}
      >
        <Copy className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
