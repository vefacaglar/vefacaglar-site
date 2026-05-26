"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary } from "../../dictionaries";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function Pagination({ currentPage, totalPages }: PaginationProps) {
  const rawPath = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const isTr = locale === "tr";
  const pathname = rawPath.replace(/^\/tr/, "") || "/";

  if (totalPages <= 1) return null;

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    const prefix = isTr ? "/tr" : "";
    return `${prefix}${pathname}?${params.toString()}`;
  };

  return (
    <nav className={styles.pagination} aria-label={dict.pagination_aria}>
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)} className={styles.pageButton}>
          {dict.previous}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {dict.previous}
        </span>
      )}

      <div className={styles.pageInfo}>
        {dict.page_of.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}
      </div>

      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)} className={styles.pageButton}>
          {dict.next}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {dict.next}
        </span>
      )}
    </nav>
  );
}
