"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useLocale } from "../LocaleProvider";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import {
  EMPTY_GAME_SUGGESTIONS,
  GAME_SEARCH_MAX_LENGTH,
  GAME_SUGGEST_MIN_LENGTH,
  GAME_SUGGESTION_GROUPS,
  gameSearchTerm,
  gameSuggestionOptions,
  parseGameSuggestions,
  type GameSuggestionGroup,
  type GameSuggestionOption,
  type GameSuggestions,
} from "../../lib/gameSearch";
import styles from "./GameSearchAutocomplete.module.css";

const BASE_PATH = "/explore/games";
const DEBOUNCE_MS = 200;
const CACHE_SIZE = 30;

type Status = "idle" | "loading" | "ready" | "error";

/** Games search box with a text-only developers / publishers / games suggestion dropdown (combobox). */
export default function GameSearchAutocomplete({
  initialQuery = "",
  placeholder,
}: {
  initialQuery?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<GameSuggestions>(EMPTY_GAME_SUGGESTIONS);
  const [status, setStatus] = useState<Status>("idle");
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLFormElement>(null);
  const cacheRef = useRef(new Map<string, GameSuggestions>());
  const lastSubmitted = useRef<string | null>(null);

  const term = gameSearchTerm(value);
  const searchable = term !== null && term.length >= GAME_SUGGEST_MIN_LENGTH;
  const options = useMemo(() => gameSuggestionOptions(suggestions), [suggestions]);
  const expanded = open && searchable && (options.length > 0 || status === "ready" || status === "loading");

  // Keep the box in sync with the URL after navigation, without clobbering a newer edit.
  useEffect(() => {
    const submitted = lastSubmitted.current;
    setValue((current) => (submitted === initialQuery && current.trim() !== submitted ? current : initialQuery));
    lastSubmitted.current = null;
  }, [initialQuery]);

  // Debounced fetch; the cleanup aborts a stale request when the term changes or the box closes.
  useEffect(() => {
    if (!open || !searchable || term === null) {
      setStatus("idle");
      return;
    }
    const key = term.toLocaleLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setSuggestions(cached);
      setStatus("ready");
      setActiveIndex(-1);
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/games/suggest?${new URLSearchParams({ q: term })}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(String(response.status));
        const next = parseGameSuggestions(await response.json());
        const cache = cacheRef.current;
        cache.set(key, next);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
        setSuggestions(next);
        setStatus("ready");
        setActiveIndex(-1);
      } catch {
        if (controller.signal.aborted) return;
        setSuggestions(EMPTY_GAME_SUGGESTIONS);
        setStatus("error");
        setActiveIndex(-1);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, searchable, term]);

  // Close on a pointer press outside the search box or its dropdown.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function navigate(href: string) {
    close();
    startTransition(() => router.push(localizeHref(href, locale)));
  }

  function select(option: GameSuggestionOption) {
    navigate(option.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!searchable) return;
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (!options.length) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        // -1 is the input itself, so the user can arrow back to their typed text.
        setActiveIndex((current) => {
          const next = current + step;
          if (next >= options.length) return -1;
          if (next < -1) return options.length - 1;
          return next;
        });
        return;
      }
      case "Enter": {
        if (expanded && activeIndex >= 0 && options[activeIndex]) {
          event.preventDefault();
          select(options[activeIndex]);
        }
        // Otherwise the form submits to the results page.
        return;
      }
      case "Escape": {
        if (expanded) {
          event.preventDefault();
          close();
        }
        return;
      }
      case "Tab":
        close();
        return;
    }
  }

  const groupLabels: Record<GameSuggestionGroup, string> = {
    developers: dict.games_search_developers,
    publishers: dict.games_search_publishers,
    games: dict.games_search_games,
  };
  const gameCount = (count: number) =>
    count === 1 ? dict.games_search_game_count_one : dict.games_search_game_count.replace("{count}", count.toLocaleString(locale));

  const activeOption = expanded && activeIndex >= 0 ? options[activeIndex] : undefined;
  let index = 0;

  return (
    <form
      ref={rootRef}
      className={styles.searchForm}
      data-pending={isPending ? "" : undefined}
      aria-busy={isPending}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const target = query ? `${BASE_PATH}?q=${encodeURIComponent(query)}` : BASE_PATH;
        lastSubmitted.current = query;
        setValue(query);
        close();
        startTransition(() => router.push(localizeHref(target, locale), { scroll: false }));
      }}
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
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={GAME_SEARCH_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
      />
      {value.length > 0 && (
        <button
          type="button"
          className={`btnGhost ${styles.searchClear}`}
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
        aria-label={placeholder}
        className={styles.dropdown}
        hidden={!expanded}
        // Keep focus in the input while a row is pressed.
        onMouseDown={(event) => event.preventDefault()}
      >
        {GAME_SUGGESTION_GROUPS.map((group) => {
          const groupOptions = options.filter((option) => option.group === group);
          if (!groupOptions.length) return null;
          const labelId = `${baseId}-${group}-label`;
          return (
            <div key={group} role="group" aria-labelledby={labelId} className={styles.group}>
              <div id={labelId} role="presentation" className={styles.groupLabel}>
                {groupLabels[group]}
              </div>
              {groupOptions.map((option) => {
                const optionIndex = index++;
                const active = optionIndex === activeIndex;
                return (
                  <div
                    key={option.key}
                    id={optionId(optionIndex)}
                    role="option"
                    aria-selected={active}
                    className={styles.option}
                    data-active={active ? "" : undefined}
                    onMouseEnter={() => setActiveIndex(optionIndex)}
                    onClick={() => select(option)}
                  >
                    {option.group === "games" ? (
                      <>
                        <span className={styles.optionTitle}>
                          {option.game.title}
                          {option.game.releaseYear !== null && (
                            <span className={styles.optionYear}> ({option.game.releaseYear})</span>
                          )}
                        </span>
                        {option.game.developer && <span className={styles.optionMeta}>{option.game.developer}</span>}
                      </>
                    ) : (
                      <>
                        <span className={styles.optionTitle}>{option.company.name}</span>
                        <span className={styles.optionMeta}>{gameCount(option.company.gameCount)}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {!options.length && (status === "ready" || status === "loading") && (
          <div className={styles.status} role="presentation">
            {status === "loading" ? dict.games_search_searching : dict.games_search_no_matches}
          </div>
        )}
      </div>
    </form>
  );
}
