"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useLocale } from "../LocaleProvider";
import { localizeHref } from "../../lib/localizeHref";
import { useDebounced } from "../../hooks/useDebounced";
import { MOVIE_SEARCH_MAX_LENGTH, movieSuggestTerm, nextMovieOptionIndex } from "../../lib/movieSearch";
import searchStyles from "../library/CatalogSearch.module.css";
import styles from "../movies/movieSearch.module.css";

const BASE_PATH = "/explore/tv-series";
type Suggestion = { id: number; title: string; premiered: string | null };

export default function TvSeriesSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const locale = useLocale();
  const listboxId = useId();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ term: string; items: Suggestion[] } | null>(null);
  const lastSubmitted = useRef<string | null>(null);
  const debounced = useDebounced(value, 200);
  const term = expanded ? movieSuggestTerm(debounced) : null;

  useEffect(() => {
    const submitted = lastSubmitted.current;
    setValue((current) => submitted === initialQuery && current.trim() !== submitted ? current : initialQuery);
    lastSubmitted.current = null;
  }, [initialQuery]);

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    fetch(`/api/tv-series/suggest?${new URLSearchParams({ q: term })}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => {
        if (controller.signal.aborted) return;
        const items = Array.isArray(data.items) ? data.items.filter((item: Suggestion) => Number.isSafeInteger(item?.id) && item.id > 0 && typeof item.title === "string" && (item.premiered === null || typeof item.premiered === "string")) : [];
        setResult({ term, items });
        setActive(-1);
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ term, items: [] }); });
    return () => controller.abort();
  }, [term]);

  const currentTerm = movieSuggestTerm(value);
  const options = result && currentTerm && result.term === currentTerm ? result.items : [];
  const open = expanded && options.length > 0;
  const activeOption = open && active >= 0 ? options[active] : undefined;
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const close = () => { setExpanded(false); setActive(-1); };
  const go = (option: Suggestion) => {
    close();
    startTransition(() => router.push(localizeHref(`${BASE_PATH}/${option.id}`, locale)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      if (!open) { setExpanded(true); setActive(event.key === "ArrowDown" ? 0 : options.length - 1); return; }
      setActive((current) => nextMovieOptionIndex(current, options.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && activeOption) {
      event.preventDefault(); go(activeOption);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); close();
    }
  };

  return <form className={`${searchStyles.searchForm} ${styles.combobox}`} data-pending={isPending ? "" : undefined} aria-busy={isPending} role="search"
    onSubmit={(event) => {
      event.preventDefault();
      const query = value.trim();
      lastSubmitted.current = query;
      setValue(query); close();
      startTransition(() => router.push(localizeHref(query ? `${BASE_PATH}?q=${encodeURIComponent(query)}` : BASE_PATH, locale), { scroll: false }));
    }}>
    <svg className={searchStyles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>
    <input className={searchStyles.searchInput} type="search" name="q" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listboxId}
      aria-activedescendant={activeOption ? optionId(active) : undefined} value={value} onChange={(event) => { setValue(event.target.value); setExpanded(true); setActive(-1); }}
      onFocus={() => setExpanded(true)} onBlur={close} onKeyDown={onKeyDown} placeholder="Search TV series" aria-label="Search TV series" maxLength={MOVIE_SEARCH_MAX_LENGTH} autoComplete="off" spellCheck={false} />
    {value.length > 0 && <button type="button" className={`btnGhost ${searchStyles.searchClear}`} onClick={() => { setValue(""); close(); }} aria-label="Clear search">×</button>}
    <div id={listboxId} role="listbox" aria-label="TV series suggestions" className={styles.listbox} hidden={!open} onMouseDown={(event) => event.preventDefault()}>
      {open && options.map((option, index) => <div key={option.id} id={optionId(index)} role="option" aria-selected={index === active} className={styles.option}
        data-active={index === active ? "" : undefined} onMouseEnter={() => setActive(index)} onClick={() => go(option)}>
        <span className={styles.optionLabel}>{option.title}</span>
        {option.premiered && <span className={styles.optionDetail}>{option.premiered.slice(0, 4)}</span>}
      </div>)}
    </div>
  </form>;
}
