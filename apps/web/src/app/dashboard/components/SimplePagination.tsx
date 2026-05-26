"use client";

import React from "react";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";

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
            {ds.pagination.prev}
          </button>
        ) : (
          <span className={styles.simplePaginationDisabled}>{ds.pagination.prev}</span>
        )}
        <span className={styles.simplePaginationInfo}>
          {ds.pagination.pageOf.replace("{activePage}", String(activePage)).replace("{totalPages}", String(totalPages || 1))}
        </span>
        {activePage < totalPages ? (
          <button
            onClick={() => onPageChange(activePage + 1)}
            className={styles.simplePaginationButton}
          >
            {ds.pagination.next}
          </button>
        ) : (
          <span className={styles.simplePaginationDisabled}>{ds.pagination.next}</span>
        )}
      </div>

      <div className={styles.pageSizeContainer}>
        <label htmlFor={selectId} className={styles.pageSizeLabel}>
          {ds.pagination.itemsPerPage}
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
