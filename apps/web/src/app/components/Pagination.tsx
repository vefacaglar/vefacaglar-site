"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "../../components/LocaleProvider";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function Pagination({ currentPage, totalPages }: PaginationProps) {
  const rawPath = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
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
    <nav className={styles.pagination} aria-label="Pagination">
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)} className={styles.pageButton}>
          {isTr ? "\u2190 \u00D6nceki" : "\u2190 Previous"}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {isTr ? "\u2190 \u00D6nceki" : "\u2190 Previous"}
        </span>
      )}

      <div className={styles.pageInfo}>
        {isTr
          ? `Sayfa ${currentPage} / ${totalPages}`
          : `Page ${currentPage} of ${totalPages}`}
      </div>

      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)} className={styles.pageButton}>
          {isTr ? "Sonraki \u2192" : "Next \u2192"}
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          {isTr ? "Sonraki \u2192" : "Next \u2192"}
        </span>
      )}
    </nav>
  );
}
