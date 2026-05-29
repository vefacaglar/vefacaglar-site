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
  githubUrl?: string | null;
  latestVersion: string;
  isActive: boolean;
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
    <section className={styles.section} style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{ds.packages.title}</h2>
        <Link href="/dashboard/packages/new" className="btnAccent">
          {ds.packages.newPackage}
        </Link>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "1.5rem" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search packages by name or slug..."
            className="input"
            style={{ flex: 1, margin: 0 }}
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
          {initialQ ? `No packages match your search query: "${initialQ}"` : ds.packages.noPackages}
        </p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>{ds.packages.name}</th>
                <th className={styles.th}>{ds.packages.latestVersion}</th>
                <th className={styles.th}>{ds.content.table.status}</th>
                <th className={styles.thRight}>{ds.content.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className={styles.tr}>
                  <td className={styles.td}>
                    <span style={{ fontWeight: 600 }}>{pkg.name}</span>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>slug: {pkg.slug}</div>
                  </td>
                  <td className={styles.td}>
                    <code style={{ fontSize: "0.9rem" }}>{pkg.latestVersion}</code>
                  </td>
                  <td className={styles.td}>
                    <span className={pkg.isActive ? styles.statusPublished : styles.statusDraft}>
                      {pkg.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <Link href={`/dashboard/packages/edit/${pkg.id}`} className={styles.editLink}>
                        {ds.content.edit}
                      </Link>
                      <DeleteButton
                        id={pkg.id}
                        type="package"
                        title={pkg.name}
                        onDelete={deletePackageAction}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
