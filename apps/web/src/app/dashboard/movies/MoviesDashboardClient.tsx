"use client";

import React, { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SimplePagination from "../components/SimplePagination";
import dashStyles from "../dashboard.module.css";
import styles from "./movies.module.css";
import ds from "../../../lib/dashboard-strings";
import { setMoviePosterBlockAction } from "./actions";
import type { DashboardMovie } from "./types";

interface MoviesDashboardClientProps {
  items: DashboardMovie[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  q: string;
  blocked: boolean;
  loadFailed: boolean;
}

export default function MoviesDashboardClient({ items, total, totalPages, page, limit, q, blocked, loadFailed }: MoviesDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchVal, setSearchVal] = useState(q);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SimplePagination fires a limit change and a page reset back to back; accumulate both into one URL.
  const pendingParams = useRef<URLSearchParams | null>(null);
  const navigate = (updates: Record<string, string | number | null>) => {
    const params = pendingParams.current ?? new URLSearchParams(searchParams.toString());
    pendingParams.current = params;
    queueMicrotask(() => { pendingParams.current = null; });
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const filterHref = (onlyBlocked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (onlyBlocked) params.set("blocked", "1");
    else params.delete("blocked");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const togglePoster = async (movie: DashboardMovie) => {
    setBusyId(movie.id);
    setError(null);
    const result = await setMoviePosterBlockAction(movie.id, !movie.posterBlocked);
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  };

  const emptyMessage = q ? ds.movies.list.emptySearch.replace("{q}", q) : blocked ? ds.movies.list.emptyBlocked : ds.movies.list.empty;

  return (
    <section className={`${dashStyles.section} ${dashStyles.sectionTransition} ${isPending ? dashStyles.pendingSection : ""}`}>
      <div className={dashStyles.sectionHeader}>
        <h2 className={dashStyles.sectionTitle}>{ds.movies.list.title}</h2>
        <div className={styles.filters}>
          <Link href={filterHref(false)} className={blocked ? styles.filter : `${styles.filter} ${styles.filterActive}`} aria-current={blocked ? undefined : "page"}>
            {ds.movies.filters.all}
          </Link>
          <Link href={filterHref(true)} className={blocked ? `${styles.filter} ${styles.filterActive}` : styles.filter} aria-current={blocked ? "page" : undefined}>
            {ds.movies.filters.blocked}
          </Link>
        </div>
      </div>

      <div className={dashStyles.searchContainer}>
        <form
          className={dashStyles.searchForm}
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: searchVal.trim(), page: null });
          }}
        >
          <input
            type="text"
            value={searchVal}
            maxLength={140}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder={ds.movies.search.placeholder}
            className={`input ${dashStyles.searchInput}`}
          />
          {q && (
            <button
              type="button"
              className="btnGhost"
              onClick={() => {
                setSearchVal("");
                navigate({ q: null, page: null });
              }}
            >
              {ds.movies.search.clear}
            </button>
          )}
          <button type="submit" className="btnAccent">
            {ds.movies.search.submit}
          </button>
        </form>
      </div>

      <p className={styles.muted}>{ds.movies.actions.blockHint}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {loadFailed ? (
        <p className={styles.error}>{ds.movies.list.loadFailed}</p>
      ) : items.length === 0 ? (
        <p className={dashStyles.empty}>{emptyMessage}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((movie) => (
              <li key={movie.id} className={styles.row}>
                <span className={styles.thumb}>
                  {movie.posterImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={movie.posterImageUrl} alt="" loading="lazy" className={movie.posterBlocked ? styles.thumbBlocked : undefined} />
                  ) : (
                    <span className={styles.thumbEmpty}>{ds.movies.list.noPoster}</span>
                  )}
                </span>
                <div className={styles.info}>
                  <div className={styles.titleLine}>
                    {movie.isPublic ? (
                      <Link href={`/explore/movies/${movie.slug}`} className={styles.movieTitle} target="_blank">
                        {movie.title}
                      </Link>
                    ) : (
                      <span className={styles.movieTitle}>{movie.title}</span>
                    )}
                    {movie.releaseYear !== null && <span className={styles.year}>{movie.releaseYear}</span>}
                  </div>
                  <div className={styles.badges}>
                    <span className={movie.isPublic ? dashStyles.statusPublished : dashStyles.statusDraft}>
                      {movie.isPublic ? ds.movies.list.public : ds.movies.list.notPublic}
                    </span>
                    {movie.posterBlocked && <span className={dashStyles.statusDraft}>{ds.movies.list.blocked}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={movie.posterBlocked ? "btnAccent" : "btnGhost"}
                  disabled={busyId !== null}
                  onClick={() => togglePoster(movie)}
                >
                  {movie.posterBlocked ? ds.movies.actions.unblock : ds.movies.actions.block}
                </button>
              </li>
            ))}
          </ul>

          <SimplePagination
            currentPage={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={(next) => navigate({ page: next })}
            onLimitChange={(next) => navigate({ limit: next, page: 1 })}
            selectId="moviesPageSize"
          />
        </>
      )}
    </section>
  );
}
