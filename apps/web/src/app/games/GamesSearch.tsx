"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./games.module.css";

/** Search box that applies its query on form submission. */
export default function GamesSearch({ initialQuery = "" }: { initialQuery?: string }) {
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
        const target = query ? `/games?q=${encodeURIComponent(query)}` : "/games";
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
        placeholder={dict.games_search_placeholder}
        aria-label={dict.games_search_placeholder}
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
