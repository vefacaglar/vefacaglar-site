"use client";

import React, { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SimplePagination from "../components/SimplePagination";
import dashStyles from "../dashboard.module.css";
import styles from "./movies.module.css";
import ds from "../../../lib/dashboard-strings";
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
  const [error] = useState<string | null>(null);

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

  const emptyMessage = q ? ds.movies.list.emptySearch.replace("{q}", q) : ds.movies.list.empty;

  return (
    <section className={`${dashStyles.section} ${dashStyles.sectionTransition} ${isPending ? dashStyles.pendingSection : ""}`}>
      <div className={dashStyles.sectionHeader}>
        <h2 className={dashStyles.sectionTitle}>{ds.movies.list.title}</h2>
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

      {error && <p className={styles.error} role="alert">{error}</p>}

      {loadFailed ? (
        <p className={styles.error}>{ds.movies.list.loadFailed}</p>
      ) : items.length === 0 ? (
        <p className={dashStyles.empty}>{emptyMessage}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((movie) => {
              const qid = movie.slug.match(/-(q\d+)$/i)?.[1]?.toUpperCase();
              return (
                <li key={movie.id} className={styles.row}>
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
                    </div>
                  </div>
                  {qid && (
                    <a
                      href={`https://www.wikidata.org/wiki/${qid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.wikidataLink}
                    >
                      {qid} ↗
                    </a>
                  )}
                </li>
              );
            })}
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
