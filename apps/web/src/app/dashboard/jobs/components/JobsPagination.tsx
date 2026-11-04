"use client";

import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import SimplePagination from "../../components/SimplePagination";

export default function JobsPagination({
  page,
  limit,
  total,
  filters,
}: {
  page: number;
  limit: number;
  total: number;
  /** Current filter params (status, recurringJobId) to keep while paging. */
  filters: Record<string, string>;
}) {
  const router = useRouter();
  // SimplePagination calls onLimitChange then onPageChange(1) synchronously; keep the
  // new limit in a ref so the single navigation below carries both.
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const go = (nextPage: number) => {
    const params = new URLSearchParams(filters);
    if (nextPage > 1) params.set("page", String(nextPage));
    if (limitRef.current !== 10) params.set("limit", String(limitRef.current));
    const qs = params.toString();
    router.push(qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs", { scroll: false });
  };

  return (
    <SimplePagination
      currentPage={page}
      totalPages={Math.ceil(total / limit) || 1}
      limit={limit}
      onPageChange={go}
      onLimitChange={(l) => {
        limitRef.current = l;
      }}
      selectId="jobs-limit"
    />
  );
}
