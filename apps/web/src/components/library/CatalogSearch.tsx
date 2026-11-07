"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "../LocaleProvider";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./CatalogSearch.module.css";

export default function CatalogSearch({
  basePath,
  initialQuery = "",
  placeholder,
  maxLength,
}: {
  basePath: string;
  initialQuery?: string;
  placeholder: string;
  maxLength?: number;
}) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const lastSubmitted = useRef<string | null>(null);

  useEffect(() => {
    const submitted = lastSubmitted.current;
    setValue((current) =>
      submitted === initialQuery && current.trim() !== submitted ? current : initialQuery,
    );
    lastSubmitted.current = null;
  }, [initialQuery]);

  return (
    <form
      className={styles.searchForm}
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const target = query ? `${basePath}?q=${encodeURIComponent(query)}` : basePath;
        lastSubmitted.current = query;
        setValue(query);
        startTransition(() => router.push(localizeHref(target, locale), { scroll: false }));
      }}
      role="search"
    >
      <svg
        className={styles.searchIcon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5L21 21" />
      </svg>
      <input
        className={styles.searchInput}
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={maxLength}
        autoComplete="off"
      />
      {value.length > 0 && (
        <button
          type="button"
          className={`btnGhost ${styles.searchClear}`}
          onClick={() => setValue("")}
          aria-label={dict.library_date_clear}
        >
          ×
        </button>
      )}
    </form>
  );
}
