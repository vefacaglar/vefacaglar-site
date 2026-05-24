"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";

export default function LanguageSwitcher() {
  const router = useRouter();
  const rawPath = usePathname();
  const locale = useLocale();
  const pathname = rawPath.replace(/^\/tr/, "") || "/";

  const handleLanguageChange = async (newLang: "en" | "tr") => {
    document.cookie = `lang=${newLang};path=/;max-age=31536000`;

    if (newLang === locale) return;

    let targetPath: string;
    if (newLang === "tr") {
      targetPath = `/tr${pathname === "/" ? "" : pathname}`;
    } else {
      targetPath = pathname;
    }

    await router.push(targetPath);
    router.refresh();
  };

  return (
    <div style={{
      display: "flex",
      gap: "8px",
      fontSize: "12px",
      fontFamily: "inherit"
    }}>
      <button
        onClick={() => handleLanguageChange("en")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          color: locale === "en" ? "var(--accent)" : "var(--muted)",
          fontWeight: locale === "en" ? "600" : "normal",
          textDecoration: locale === "en" ? "underline" : "none",
        }}
      >
        en
      </button>
      <span style={{ color: "var(--border)" }}>|</span>
      <button
        onClick={() => handleLanguageChange("tr")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          color: locale === "tr" ? "var(--accent)" : "var(--muted)",
          fontWeight: locale === "tr" ? "600" : "normal",
          textDecoration: locale === "tr" ? "underline" : "none",
        }}
      >
        tr
      </button>
    </div>
  );
}
