"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";

NProgress.configure({ showSpinner: false, minimum: 0.15, trickleSpeed: 120 });

const MIN_VISIBLE_MS = 350;

export default function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startedAtRef = useRef<number | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startedAtRef.current === null) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    doneTimerRef.current = setTimeout(() => {
      NProgress.done();
      startedAtRef.current = null;
      doneTimerRef.current = null;
    }, remaining);

    return () => {
      if (doneTimerRef.current) {
        clearTimeout(doneTimerRef.current);
        doneTimerRef.current = null;
      }
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    console.log("[ProgressBar] mounted, listener attached");
    const handleClick = (event: MouseEvent) => {
      console.log("[ProgressBar] click", event.target);
      if (event.defaultPrevented) { console.log("[ProgressBar] skip: defaultPrevented"); return; }
      if (event.button !== 0) { console.log("[ProgressBar] skip: button", event.button); return; }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { console.log("[ProgressBar] skip: modifier"); return; }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) { console.log("[ProgressBar] skip: no anchor"); return; }
      console.log("[ProgressBar] anchor", anchor.getAttribute("href"));

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (targetUrl.origin !== window.location.origin) return;
      if (
        targetUrl.pathname === window.location.pathname &&
        targetUrl.search === window.location.search
      ) {
        return;
      }

      console.log("[ProgressBar] starting NProgress");
      startedAtRef.current = Date.now();
      NProgress.start();
      console.log("[ProgressBar] #nprogress in DOM?", document.getElementById("nprogress"));
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
