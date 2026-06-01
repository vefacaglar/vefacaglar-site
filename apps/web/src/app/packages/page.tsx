import React from "react";
import Link from "next/link";
import styles from "./packages.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { localizedAlternates } from "../../lib/seo";
import Pagination from "../components/Pagination";
import { getPublicPackages } from "../../lib/data";

export const revalidate = 300;

export async function generateMetadata() {
  return {
    title: "Packages | Vefa Çağlar",
    description: "Open source packages and documentation library developed by Vefa Çağlar.",
    alternates: localizedAlternates("/packages", getActiveLanguage(), { bilingual: false }),
  };
}

interface PackagesProps {
  searchParams: {
    page?: string;
  };
}

export default async function PackagesPage({ searchParams }: PackagesProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const data = await getPublicPackages(page);
  const packages = (data?.items ?? []) as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    nugetUrl: string | null;
    npmUrl: string | null;
    githubUrl: string | null;
    docs: string | null;
    latestVersion: string;
  }[];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div>
      <h1>packages</h1>
      <p className={styles.subtitle}>open source libraries and packages for modern applications.</p>

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
                    <Link href={`/packages/${pkg.slug}/docs`} className={styles.link}>
                      documentation
                    </Link>
                    {pkg.nugetUrl && (
                      <a href={pkg.nugetUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        nuget
                      </a>
                    )}
                    {pkg.npmUrl && (
                      <a href={pkg.npmUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        npm
                      </a>
                    )}
                    {pkg.githubUrl && (
                      <a href={pkg.githubUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                        github
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
