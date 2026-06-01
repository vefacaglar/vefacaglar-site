import React from "react";
import styles from "./GamesPagination.module.css";
import ds from "../../../../lib/dashboard-strings";

interface GamesPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (limit: number) => void;
}

const PAGE_SIZES = [12, 24, 48, 96];
const MAX_PAGES_SHOWN = 5;

function buildPageNumbers(page: number, totalPages: number): (number | string)[] {
  if (totalPages <= MAX_PAGES_SHOWN) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | string)[] = [1];
  if (page > 3) pages.push("...");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}

export default function GamesPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: GamesPaginationProps) {
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (totalPages <= 1) return null;

  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.paginationInfo}>
        {ds.games.pagination.showing
          .replace("{start}", String(startItem))
          .replace("{end}", String(endItem))
          .replace("{total}", String(total))}
      </div>
      <div className={styles.paginationControls}>
        <button
          type="button"
          className={`${styles.paginationBtn} ${page === 1 ? styles.paginationBtnDisabled : ""}`}
          onClick={() => page > 1 && onPageChange(page - 1)}
          disabled={page === 1}
          title={ds.games.pagination.prev}
        >
          <span className={styles.paginationBtnArrow}>←</span>
          <span className={styles.paginationBtnText}> {ds.games.pagination.prev.replace("←", "").trim()}</span>
        </button>

        <div className={styles.paginationPagesList}>
          {pageNumbers.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className={`${styles.paginationBtn} ${p === page ? styles.paginationBtnActive : ""} ${p === "..." ? styles.paginationBtnDisabled : ""}`}
              onClick={() => typeof p === "number" && onPageChange(p)}
              disabled={p === "..."}
            >
              {p}
            </button>
          ))}
        </div>

        <span className={styles.paginationMobileInfo}>
          {page} / {totalPages}
        </span>

        <button
          type="button"
          className={`${styles.paginationBtn} ${page === totalPages ? styles.paginationBtnDisabled : ""}`}
          onClick={() => page < totalPages && onPageChange(page + 1)}
          disabled={page === totalPages}
          title={ds.games.pagination.next}
        >
          <span className={styles.paginationBtnText}>{ds.games.pagination.next.replace("→", "").trim()} </span>
          <span className={styles.paginationBtnArrow}>→</span>
        </button>
      </div>
      <div className={styles.paginationPageSize}>
        <span>{ds.games.pagination.itemsPerPage}</span>
        <select
          className={styles.paginationSelect}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
