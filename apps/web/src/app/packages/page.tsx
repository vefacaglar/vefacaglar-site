import React from "react";
import Link from "next/link";
import styles from "./packages.module.css";
import { httpClient } from "../../lib/httpClient";
import Pagination from "../components/Pagination";

interface PackageItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nugetUrl: string | null;
  githubUrl: string | null;
  docs: string | null;
  latestVersion: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "NuGet Packages | Vefa Çağlar",
    description: "Open source NuGet packages and documentation library developed by Vefa Çağlar.",
  };
}

interface PackagesProps {
  searchParams: {
    page?: string;
  };
}

export default async function PackagesPage({ searchParams }: PackagesProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  let packagesData = {
    items: [] as PackageItem[],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  };

  try {
    const res = await httpClient.get(`/api/packages?page=${page}&limit=10`, {
      cache: "no-store",
    });
    if (res.ok) {
      packagesData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch public packages:", error);
  }

  const packages = packagesData.items || [];
  const totalPages = packagesData.totalPages || 0;

  return (
    <div>
      <h1>nuget packages</h1>
      <p className={styles.subtitle}>open source c# and nuget libraries for modern web applications.</p>

      {packages.length === 0 ? (
        <p className={styles.empty}>no packages published yet.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {packages.map((pkg) => (
              <li key={pkg.id} className={styles.listItem}>
                <span className={styles.dash}>—</span>
                <div className={styles.itemMeta}>
                  <div>
                    <Link href={`/packages/${pkg.slug}`} className={styles.packageName}>
                      {pkg.name}
                    </Link>
                    <span className={styles.versionBadge}>v{pkg.latestVersion}</span>
                  </div>
                  {pkg.description && <p className={styles.description}>{pkg.description}</p>}
                  <div className={styles.links}>
                    <Link href={`/packages/${pkg.slug}`} className={styles.link}>
                      documentation
                    </Link>
                    {pkg.nugetUrl && (
                      <a href={pkg.nugetUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        nuget
                      </a>
                    )}
                    {pkg.githubUrl && (
                      <a href={pkg.githubUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        github
                      </a>
                    )}
                    {pkg.docs && (
                      <a href={pkg.docs} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        external docs
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
