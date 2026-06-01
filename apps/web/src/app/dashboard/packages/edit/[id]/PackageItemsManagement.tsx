"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../../../dashboard.module.css";
import { deletePackageItemAction } from "../../actions";

interface PackageItem {
  id: string;
  slug: string;
  name: string;
  nugetUrl?: string | null;
  npmUrl?: string | null;
  githubUrl?: string | null;
  latestVersion: string;
  isActive: boolean;
}

interface PackageItemsManagementProps {
  groupId: string;
  packages: PackageItem[];
}

export default function PackageItemsManagement({ groupId, packages }: PackageItemsManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (item: PackageItem) => {
    if (!confirm(`Are you sure you want to delete package "${item.name}"?`)) return;

    const result = await deletePackageItemAction(groupId, item.id);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <section className={`${styles.section} ${isPending ? styles.pendingSection : ""}`}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Packages in this group</h2>
        <Link href={`/dashboard/package/new?groupId=${groupId}`} className="btnAccent">
          Add package
        </Link>
      </div>

      {error && <div className="errorMsg">{error}</div>}

      {packages.length === 0 ? (
        <p className={styles.empty}>No packages added to this group yet.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Version</th>
                <th className={styles.th}>Links</th>
                <th className={styles.th}>Status</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((item) => (
                <tr key={item.id} className={styles.tr}>
                  <td className={styles.td}>
                    <span>{item.name}</span>
                    <div className={styles.meta}>slug: /{item.slug}</div>
                  </td>
                  <td className={styles.td}>{item.latestVersion}</td>
                  <td className={styles.td}>
                    {[item.nugetUrl && "nuget", item.npmUrl && "npm", item.githubUrl && "github"].filter(Boolean).join(", ") || "none"}
                  </td>
                  <td className={styles.td}>
                    <span className={item.isActive ? styles.statusPublished : styles.statusDraft}>
                      {item.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <Link href={`/dashboard/package/${item.id}`} className={styles.editLink}>
                        Edit
                      </Link>
                      <button type="button" className={`${styles.editLink} ${styles.linkButton}`} onClick={() => handleDelete(item)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
