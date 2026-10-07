"use client";

import { LogOut, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";

export function ProfileActions() {
  const { t } = useI18n();
  const router = useRouter();
  const signOut = async () => {
    await api("/api/session/logout", { body: {} });
    router.replace("/");
    router.refresh();
  };
  return (
    <div className="grid grid-cols-2 gap-3 pb-4">
      <Button onClick={signOut}>
        <Users className="size-4" aria-hidden /> {t.profile.switchProfile}
      </Button>
      <Button variant="ghost" onClick={signOut}>
        <LogOut className="size-4" aria-hidden /> {t.profile.signOut}
      </Button>
    </div>
  );
}
