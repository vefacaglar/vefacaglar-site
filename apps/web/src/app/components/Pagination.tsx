"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary } from "../../dictionaries";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Overrides for sections with their own wording (the library uses sentence case). */
  labels?: { previous: string; next: string; pageOf: string };
  /** Extra class for the nav, for sections with their own look. */
  className?: string;
}

export default function Pagination({ currentPage, totalPages, labels, className }: PaginationProps) {
  const rawPath = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const pathname = rawPath || "/";

  if (totalPages <= 1) return null;

  const previous = labels?.previous ?? dict.previous;
  const next = labels?.next ?? dict.next;
  const pageOf = labels?.pageOf ?? dict.page_of;

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    // Existing params (including `lang`) are kept, so the language carries over.
    return `${pathname}?${params.toString()}`;
  };

  return (
    <nav className={className ? `${styles.pagination} ${className}` : styles.pagination} aria-label={dict.pagination_aria}>
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)} className={styles.pageButton}>
          {previous}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {previous}
        </span>
      )}

      <div className={styles.pageInfo}>
        {pageOf.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
      </div>

      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)} className={styles.pageButton}>
          {next}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {next}
        </span>
      )}
    </nav>
  );
}
