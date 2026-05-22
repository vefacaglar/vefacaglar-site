"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LanguageSwitcher() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "tr">("en");

  useEffect(() => {
    const cookies = document.cookie.split(";");
    const langCookie = cookies.find((c) => c.trim().startsWith("lang="));
    if (langCookie) {
      const val = langCookie.split("=")[1]?.trim();
      if (val === "tr" || val === "en") {
        setLang(val);
      }
    } else {
      // Default to browser language if cookie not set
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith("tr")) {
        setLang("tr");
      }
    }
  }, []);

  const handleLanguageChange = (newLang: "en" | "tr") => {
    document.cookie = `lang=${newLang};path=/;max-age=31536000`;
    setLang(newLang);
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
          color: lang === "en" ? "var(--accent)" : "var(--muted)",
          fontWeight: lang === "en" ? "600" : "normal",
          textDecoration: lang === "en" ? "underline" : "none",
        }}
      >
        EN
      </button>
      <span style={{ color: "var(--border)" }}>|</span>
      <button
        onClick={() => handleLanguageChange("tr")}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 4px",
          color: lang === "tr" ? "var(--accent)" : "var(--muted)",
          fontWeight: lang === "tr" ? "600" : "normal",
          textDecoration: lang === "tr" ? "underline" : "none",
        }}
      >
        TR
      </button>
    </div>
  );
}
