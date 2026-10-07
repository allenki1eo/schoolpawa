import { Suspense } from "react";
import { OfflineView } from "@/components/offline/offline-view";

export const metadata = { title: "Bila mtandao" };

/** Works without a session (pre-consent starter practice) and without a network (SW cached). */
export default function OfflinePage() {
  return (
    <Suspense>
      <OfflineView />
    </Suspense>
  );
}
