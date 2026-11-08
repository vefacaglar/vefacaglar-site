"use client";
import { useCallback, useEffect, useState } from "react";
import { istanbulToday } from "./logDates";

/** Keep an open form aligned with the Istanbul day after midnight or refocus. */
export function useLogCalendarToday(active: boolean): [string, () => void] {
  const [today, setToday] = useState(() => istanbulToday());
  const refresh = useCallback(() => setToday(istanbulToday()), []);
  useEffect(() => {
    if (!active) return;
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, refresh]);
  return [today, refresh];
}
