"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SubTab } from "../types";

const NO_PAGINATION_TABS: SubTab[] = ["genres", "themes", "platforms"];
const NO_PAGINATION_LIMIT = 250;
const DEFAULT_LIMIT = 12;
const BASE_PATH = "/dashboard/games";

interface UseGamesNavigationProps {
  initialTab: SubTab;
  initialPage: number;
  initialLimit: number;
  initialSearch: string;
  initialTotal: number;
}

interface NavigateParams {
  tab?: SubTab;
  page?: number;
  limit?: number;
  q?: string;
}

function isNoPaginationTab(tab: SubTab): boolean {
  return NO_PAGINATION_TABS.includes(tab);
}

export function useGamesNavigation({
  initialTab,
  initialPage,
  initialLimit,
  initialSearch,
  initialTotal,
}: UseGamesNavigationProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  const [counts, setCounts] = useState<Partial<Record<SubTab, number>>>({
    [initialTab]: initialTotal,
  });
  useEffect(() => {
    setCounts((c) => ({ ...c, [initialTab]: initialTotal }));
  }, [initialTab, initialTotal]);

  const navigateTo = useCallback(
    (updated: NavigateParams) => {
      const targetTab = updated.tab !== undefined ? updated.tab : initialTab;
      const params = new URLSearchParams();
      params.set("tab", targetTab);

      if (isNoPaginationTab(targetTab)) {
        params.set("page", "1");
        params.set("limit", String(NO_PAGINATION_LIMIT));
      } else {
        const page = updated.page !== undefined ? updated.page : initialPage;
        const limit = updated.limit !== undefined ? updated.limit : initialLimit;
        params.set("page", String(page));
        if (limit !== DEFAULT_LIMIT) {
          params.set("limit", String(limit));
        }
      }

      const q = updated.q !== undefined ? updated.q : searchQuery;
      if (q.trim()) {
        params.set("q", q);
      }

      startTransition(() => {
        router.push(`${BASE_PATH}?${params.toString()}`, { scroll: false });
      });
    },
    [initialTab, initialPage, initialLimit, searchQuery, router]
  );

  const getReturnUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", initialTab);
    params.set("page", String(initialPage));
    if (initialLimit !== DEFAULT_LIMIT) {
      params.set("limit", String(initialLimit));
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    return `${BASE_PATH}?${params.toString()}`;
  }, [initialTab, initialPage, initialLimit, searchQuery]);

  const handleTabChange = useCallback(
    (newTab: SubTab) => {
      navigateTo({ tab: newTab, page: 1, q: "", limit: DEFAULT_LIMIT });
    },
    [navigateTo]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateTo({ page: newPage });
    },
    [navigateTo]
  );

  const handlePageSizeChange = useCallback(
    (newLimit: number) => {
      navigateTo({ page: 1, limit: newLimit });
    },
    [navigateTo]
  );

  return {
    activeSubTab: initialTab,
    page: initialPage,
    pageSize: initialLimit,
    searchQuery,
    counts,
    isPending,
    setSearchQuery,
    navigateTo,
    getReturnUrl,
    handleTabChange,
    handlePageChange,
    handlePageSizeChange,
  };
}
