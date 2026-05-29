"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function WidthController() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.includes("/docs/")) {
      // Spacious documentation readers (Sidebar + Content)
      document.documentElement.style.setProperty("--max", "1100px");
    } else {
      // Fallback to global default (960px)
      document.documentElement.style.removeProperty("--max");
    }
  }, [pathname]);

  return null;
}
