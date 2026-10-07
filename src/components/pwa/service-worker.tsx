"use client";

import { useEffect } from "react";
import { flushQueue } from "@/lib/offline/sync";

/** Registers the service worker and flushes the offline result queue whenever we come online. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "flush-queue") void flushQueue();
      });
    }
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void flushQueue();
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
