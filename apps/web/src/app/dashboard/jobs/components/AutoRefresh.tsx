"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server page on an interval while `active` (skipped when the tab is hidden). */
export default function AutoRefresh({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
