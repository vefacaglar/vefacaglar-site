"use client";

import { useEffect } from "react";

const STORAGE_KEY = "auth-warmup";

/**
 * Wakes the identity provider (hosted on a platform that sleeps when idle) in the
 * background, so it is already awake when someone later opens the dashboard login.
 * Fire-and-forget: the opaque no-cors request never blocks rendering.
 */
export default function AuthWarmup({ url }: { url: string }) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable; a repeated ping is harmless.
    }

    fetch(url, { mode: "no-cors", cache: "no-store", credentials: "omit" }).catch(() => {});
  }, [url]);

  return null;
}
