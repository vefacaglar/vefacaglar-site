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

  const [isPending, startTransition] = React.useTransition();

  const handleLanguageChange = (newLang: "en" | "tr") => {
    document.cookie = `lang=${newLang};path=/;max-age=31536000`;

    if (newLang === locale) return;

    let targetPath: string;
    if (newLang === "tr") {
      targetPath = `/tr${pathname === "/" ? "" : pathname}`;
    } else {
      targetPath = pathname;
    }

    // Merge existing search params and set/update 'lang' query parameter
    // to bypass Next.js client-side router cache key collisions
    const params = new URLSearchParams(window.location.search);
    params.set("lang", newLang);

    const finalPath = `${targetPath}?${params.toString()}`;

    startTransition(() => {
      router.push(finalPath);
      router.refresh();
    });
  };

  const btnClass = (lang: "en" | "tr") =>
    locale === lang ? `${styles.btn} ${styles.btnActive}` : styles.btn;

  return (
    <div className={styles.switcher}>
      <button 
        onClick={() => handleLanguageChange("en")} 
        className={btnClass("en")}
        disabled={isPending}
      >
        en
      </button>
      <span className={styles.divider}>|</span>
      <button 
        onClick={() => handleLanguageChange("tr")} 
        className={btnClass("tr")}
        disabled={isPending}
      >
        tr
      </button>
    </div>
  );
}
