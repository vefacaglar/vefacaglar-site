"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useLocale } from "../LocaleProvider";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { useDebounced } from "../../hooks/useDebounced";
import type { MovieSuggestions } from "../../lib/movies";
import {
  MOVIE_SEARCH_MAX_LENGTH, MOVIE_SUGGEST_ENDPOINT, movieSearchOptions, movieSuggestTerm, nextMovieOptionIndex,
  type MovieSearchOption,
} from "../../lib/movieSearch";
import searchStyles from "../library/CatalogSearch.module.css";
import styles from "./movieSearch.module.css";

const BASE_PATH = "/explore/movies";
const EMPTY: MovieSuggestions = { movies: [], people: [] };

/** Movie catalog search with a text-only title/people combobox. Enter without a highlighted option opens the results page. */
export default function MovieSearch({ initialQuery = "", placeholder }: { initialQuery?: string; placeholder: string }) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const listboxId = useId();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  // Suggestions are tagged with the term they answer, so a slower or older
  // response can never be shown (or selected) for different input.
  const [result, setResult] = useState<{ term: string; data: MovieSuggestions } | null>(null);
  const lastSubmitted = useRef<string | null>(null);
  const debounced = useDebounced(value, 200);
  // Nothing is fetched for the server-rendered query until the user focuses or edits.
  const term = expanded ? movieSuggestTerm(debounced) : null;

  useEffect(() => {
    const submitted = lastSubmitted.current;
    setValue((current) =>
      submitted === initialQuery && current.trim() !== submitted ? current : initialQuery,
    );
    lastSubmitted.current = null;
  }, [initialQuery]);

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const settle = (data: MovieSuggestions) => {
      setResult({ term, data });
      setActive(-1);
    };
    fetch(`${MOVIE_SUGGEST_ENDPOINT}?${new URLSearchParams({ q: term })}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<MovieSuggestions>) : EMPTY))
      .then((data) => settle({ movies: data.movies ?? [], people: data.people ?? [] }))
      .catch(() => {
        // An aborted request is superseded by a newer term; a failed one shows nothing.
        if (!controller.signal.aborted) settle(EMPTY);
      });
    return () => controller.abort();
  }, [term]);

  const roleLabels = useMemo(
    () => ({ cast: dict.movie_role_cast, director: dict.movie_role_director, producer: dict.movie_role_producer }),
    [dict],
  );
  const currentTerm = movieSuggestTerm(value);
  const suggestions = result && currentTerm && result.term === currentTerm ? result.data : EMPTY;
  const options = useMemo(() => movieSearchOptions(suggestions, roleLabels), [suggestions, roleLabels]);
  const open = expanded && options.length > 0;
  const activeOption = open && active >= 0 ? options[active] : undefined;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const close = () => {
    setExpanded(false);
    setActive(-1);
  };
  const go = (option: MovieSearchOption) => {
    close();
    startTransition(() => router.push(localizeHref(option.href, locale)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      if (!open) {
        setExpanded(true);
        setActive(event.key === "ArrowDown" ? 0 : options.length - 1);
        return;
      }
      setActive((current) => nextMovieOptionIndex(current, options.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      go(activeOption);
    } else if (event.key === "Escape" && open) {
      // Close the list first; a second Escape keeps the browser's clear-search behavior.
      event.preventDefault();
      close();
    }
  };

  const groups = [
    { key: "movies", label: dict.movies_search_titles, start: 0, items: options.filter((option) => option.kind === "movie") },
    { key: "people", label: dict.movies_search_people, start: suggestions.movies.length, items: options.filter((option) => option.kind === "person") },
  ].filter((group) => group.items.length > 0);

  return (
    <form
      className={`${searchStyles.searchForm} ${styles.combobox}`}
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const target = query ? `${BASE_PATH}?q=${encodeURIComponent(query)}` : BASE_PATH;
        lastSubmitted.current = query;
        setValue(query);
        close();
        startTransition(() => router.push(localizeHref(target, locale), { scroll: false }));
      }}
      role="search"
    >
      <svg
        className={searchStyles.searchIcon}
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
        className={searchStyles.searchInput}
        type="search"
        name="q"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOption ? optionId(active) : undefined}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setExpanded(true);
          setActive(-1);
        }}
        onFocus={() => setExpanded(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={MOVIE_SEARCH_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
      />
      {value.length > 0 && (
        <button
          type="button"
          className={`btnGhost ${searchStyles.searchClear}`}
          onClick={() => {
            setValue("");
            close();
          }}
          aria-label={dict.library_date_clear}
        >
          ×
        </button>
      )}
      <div
        id={listboxId}
        role="listbox"
        aria-label={dict.movies_search_suggestions}
        className={styles.listbox}
        hidden={!open}
        // Keep focus in the input so a click selects instead of blurring (which closes the list).
        onMouseDown={(event) => event.preventDefault()}
      >
        {open && groups.map((group) => (
          <div key={group.key} role="group" aria-labelledby={`${listboxId}-${group.key}`} className={styles.group}>
            <div id={`${listboxId}-${group.key}`} className={styles.groupLabel}>{group.label}</div>
            {group.items.map((option, offset) => {
              const index = group.start + offset;
              return (
                <div
                  key={option.key}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={styles.option}
                  data-active={index === active ? "" : undefined}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(option)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {option.detail && <span className={styles.optionDetail}>{option.detail}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </form>
  );
}
