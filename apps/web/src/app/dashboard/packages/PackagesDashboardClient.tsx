"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import DeleteButton from "../components/DeleteButton";
import SimplePagination from "../components/SimplePagination";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";
import { deletePackageAction } from "./actions";

interface PackageItem {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  nugetUrl?: string | null;
  npmUrl?: string | null;
  githubUrl?: string | null;
  docs?: string | null;
  latestVersion: string;
  isActive: boolean;
  packageCount?: number;
}

interface PackagesDashboardClientProps {
  packages: PackageItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  q: string;
}

export default function PackagesDashboardClient({
  packages,
  total,
  page,
  limit,
  totalPages,
  q: initialQ,
}: PackagesDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchVal, setSearchVal] = useState(initialQ);

  const updateQueryParam = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchVal.trim()) {
      params.set("q", searchVal.trim());
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <section className={`${styles.section} ${styles.sectionTransition} ${isPending ? styles.pendingSection : ""}`}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Package groups</h2>
        <Link href="/dashboard/packages/new" className="btnAccent">
          New group
        </Link>
      </div>

      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search groups by name or slug..."
            className={`input ${styles.searchInput}`}
          />
          {initialQ && (
            <button
              type="button"
              className="btnGhost"
              onClick={() => {
                setSearchVal("");
                const params = new URLSearchParams(searchParams.toString());
                params.delete("q");
                params.set("page", "1");
                router.push(`${pathname}?${params.toString()}`);
              }}
            >
              Clear
            </button>
          )}
          <button type="submit" className="btnAccent">
            Search
          </button>
        </form>
      </div>

      {total === 0 ? (
        <p className={styles.empty}>
          {initialQ ? `No package groups match your search query: "${initialQ}"` : "No package groups yet."}
        </p>
      ) : (
        <>
          <div className={styles.cardsGrid}>
            {packages.map((pkg) => (
              <div key={pkg.id} className={styles.card}>
                <div>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{pkg.name}</h3>
                    <span className={pkg.isActive ? styles.statusPublished : styles.statusDraft}>
                      {pkg.isActive ? "active" : "inactive"}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <div>slug: {pkg.slug}</div>
                    <div>{pkg.packageCount ?? 0} packages</div>
                    <div className={styles.cardVersion}>
                      <code>v{pkg.latestVersion}</code>
                    </div>
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.cardActions}>
                    <Link href={`/dashboard/package-groups/${pkg.id}`} className={styles.editLink}>
                      {ds.content.edit}
                    </Link>
                    <DeleteButton
                      id={pkg.id}
                      type="package"
                      title={pkg.name}
                      confirmMessage={
                        (pkg.packageCount ?? 0) > 0
                          ? `This package group has ${pkg.packageCount} package${pkg.packageCount === 1 ? "" : "s"} linked to it. Deleting it will also delete those packages and group documentation. Continue?`
                          : undefined
                      }
                      onDelete={deletePackageAction}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SimplePagination
            currentPage={page}
            totalPages={totalPages}
            limit={limit}
            onPageChange={(page) => updateQueryParam({ page })}
            onLimitChange={(limit) => updateQueryParam({ limit, page: 1 })}
            selectId="packagesPageSize"
          />
        </>
      )}
    </section>
  );
}
