"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/providers/i18n";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function ConnectivityBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-orange-500/15 px-4 py-2 text-center text-xs font-medium text-orange-200 backdrop-blur">
      <WifiOff className="size-3.5" aria-hidden />
      {t.common.offline}
    </div>
  );
}
