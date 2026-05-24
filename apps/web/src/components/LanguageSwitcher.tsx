"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import styles from "./LanguageSwitcher.module.css";

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

  const btnClass = (lang: "en" | "tr") =>
    locale === lang ? `${styles.btn} ${styles.btnActive}` : styles.btn;

  return (
    <div className={styles.switcher}>
      <button onClick={() => handleLanguageChange("en")} className={btnClass("en")}>
        en
      </button>
      <span className={styles.divider}>|</span>
      <button onClick={() => handleLanguageChange("tr")} className={btnClass("tr")}>
        tr
      </button>
    </div>
  );
}
