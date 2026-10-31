"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher() {
  const router = useRouter();
  const rawPath = usePathname();
  const locale = useLocale();
  const pathname = rawPath || "/";

  const [isPending, startTransition] = React.useTransition();

  const handleLanguageChange = (newLang: "en" | "tr") => {
    document.cookie = `lang=${newLang};path=/;max-age=31536000`;

    if (newLang === locale) return;

    // The language lives in the `lang` query param; English is the default and
    // has no param, so canonical English URLs stay clean.
    const params = new URLSearchParams(window.location.search);
    if (newLang === "tr") params.set("lang", "tr");
    else params.delete("lang");
    const query = params.toString();
    const finalPath = query ? `${pathname}?${query}` : pathname;

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
