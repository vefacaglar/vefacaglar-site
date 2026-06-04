import React from "react";
import Link from "next/link";
import styles from "./packages.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { localizedAlternates } from "../../lib/seo";
import Pagination from "../components/Pagination";
import { getPublicPackages } from "../../lib/data";


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
  const packageGroups = (data?.items ?? []) as {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    nugetUrl: string | null;
    npmUrl: string | null;
    githubUrl: string | null;
    docs: string | null;
    latestVersion: string;
    packageCount: number;
  }[];
  const totalPages = data?.totalPages ?? 0;

  return (
    <div>
      <h1>packages</h1>
      <p className={styles.subtitle}>open source package groups and documentation.</p>

      {packageGroups.length === 0 ? (
        <p className={styles.empty}>no package groups published yet.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {packageGroups.map((group) => (
              <li key={group.id} className={styles.listItem}>
                <span className={styles.dash}>—</span>
                <div className={styles.itemMeta}>
                  <div>
                    <Link href={`/packages/${group.slug}`} className={styles.packageName}>
                      {group.name}
                    </Link>
                    <span className={styles.versionBadge}>{group.packageCount} packages</span>
                  </div>
                  {group.description && <p className={styles.description}>{group.description}</p>}
                  <div className={styles.links}>
                    <Link href={`/packages/${group.slug}/docs`} className={styles.link}>
                      documentation
                    </Link>
                    {group.githubUrl && (
                      <a href={group.githubUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
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
