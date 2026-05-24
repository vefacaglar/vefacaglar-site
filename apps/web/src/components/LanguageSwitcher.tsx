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

  const nextLang = locale === "en" ? "tr" : "en";

  return (
    <div className={styles.switcher}>
      <button 
        onClick={() => handleLanguageChange(nextLang)} 
        className={styles.btn}
        disabled={isPending}
      >
        {nextLang}
      </button>
    </div>
  );
}
