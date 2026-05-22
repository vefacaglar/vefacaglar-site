"use client";

import React from "react";
import styles from "../dashboard.module.css";

interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  selectId: string;
}

export default function SimplePagination({
  currentPage,
  totalPages,
  limit,
  onPageChange,
  onLimitChange,
  selectId,
}: SimplePaginationProps) {
  const activePage = Math.min(currentPage, Math.max(1, totalPages));

  return (
    <div className={styles.paginationRow}>
      <div className={styles.simplePagination}>
        {activePage > 1 ? (
          <button
            onClick={() => onPageChange(activePage - 1)}
            className={styles.simplePaginationButton}
          >
            ← Prev
          </button>
        ) : (
          <span className={styles.simplePaginationDisabled}>← Prev</span>
        )}
        <span className={styles.simplePaginationInfo}>
          Page {activePage} of {totalPages || 1}
        </span>
        {activePage < totalPages ? (
          <button
            onClick={() => onPageChange(activePage + 1)}
            className={styles.simplePaginationButton}
          >
            Next →
          </button>
        ) : (
          <span className={styles.simplePaginationDisabled}>Next →</span>
        )}
      </div>

      <div className={styles.pageSizeContainer}>
        <label htmlFor={selectId} className={styles.pageSizeLabel}>
          Items per page:
        </label>
        <select
          id={selectId}
          value={limit}
          onChange={(e) => {
            onLimitChange(Number(e.target.value));
            onPageChange(1);
          }}
          className={styles.pageSizeSelect}
        >
          <option value="10">10</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
  );
}
