"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./Pagination.module.css";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {currentPage > 1 ? (
        <Link href={createPageUrl(currentPage - 1)} className={styles.pageButton}>
          ← Previous
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          ← Previous
        </span>
      )}

      <div className={styles.pageInfo}>
        Page {currentPage} of {totalPages}
      </div>

      {currentPage < totalPages ? (
        <Link href={createPageUrl(currentPage + 1)} className={styles.pageButton}>
          Next →
        </Link>
      ) : (
        <span className={`${styles.pageButton} ${styles.disabled}`}>
          Next →
        </span>
      )}
    </nav>
  );
}
