/** Tiny typed fetch wrapper for the student API. Never throws; returns { ok, data | error }. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; details?: Record<string, unknown> };

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
      credentials: "same-origin",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const { error, ...details } = json;
      return { ok: false, error: typeof error === "string" ? error : "generic", status: res.status, details };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "network", status: 0 };
  }
}

/** Light haptic tap where supported (and not under reduced motion). */
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}
