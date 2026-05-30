import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { httpClient } from "../../../lib/httpClient";
import styles from "./packageLayout.module.css";

interface SidebarCategory {
  id: string;
  title: string;
  slug: string;
  displayOrder: number;
}

interface SidebarDoc {
  id: string;
  categoryId: string | null;
  slug: string;
  title: string;
  description: string | null;
  displayOrder: number;
}

interface PackageDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nugetUrl: string | null;
  npmUrl: string | null;
  githubUrl: string | null;
  docs: string | null;
  latestVersion: string;
  content: string;
  categories: SidebarCategory[];
  docsList: SidebarDoc[];
}

export const dynamic = "force-dynamic";

export default async function PackageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  let pkg: PackageDetail | null = null;

  try {
    const res = await httpClient.get(`/api/packages/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      pkg = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch package details for layout:", error);
  }

  if (!pkg) {
    notFound();
  }

  // Sort categories and docs by displayOrder
  const sortedCategories = [...pkg.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  const sortedDocs = [...pkg.docsList].sort((a, b) => a.displayOrder - b.displayOrder);

  // Group docs by category
  const uncategorizedDocs = sortedDocs.filter((doc) => !doc.categoryId);
  const docsByCategory = sortedCategories.reduce((acc, cat) => {
    acc[cat.id] = sortedDocs.filter((doc) => doc.categoryId === cat.id);
    return acc;
  }, {} as Record<string, SidebarDoc[]>);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.packageTitle}>
          <Link href={`/packages/${pkg.slug}`} className={styles.packageLink}>
            {pkg.name}
          </Link>
        </div>

        <ul className={styles.metaList}>
          <li className={styles.metaItem}>version: {pkg.latestVersion}</li>
          {pkg.nugetUrl && (
            <li className={styles.metaItem}>
              <a href={pkg.nugetUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                nuget
              </a>
            </li>
          )}
          {pkg.npmUrl && (
            <li className={styles.metaItem}>
              <a href={pkg.npmUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                npm
              </a>
            </li>
          )}
          {pkg.githubUrl && (
            <li className={styles.metaItem}>
              <a href={pkg.githubUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                github
              </a>
            </li>
          )}
          {(pkg.docs || pkg.docsList.length > 0) && (
            <li className={styles.metaItem}>
              <Link href={`/packages/${pkg.slug}/docs`} className={styles.metaLink}>
                documentation
              </Link>
            </li>
          )}
        </ul>

        {/* Documentation TOC */}
        <div className={styles.tocSection}>
          <div className={styles.tocTitle}>Documentation</div>
          
          {uncategorizedDocs.length > 0 && (
            <ul className={styles.tocList} style={{ marginBottom: "16px" }}>
              {uncategorizedDocs.map((doc) => (
                <li key={doc.id} className={styles.tocItem}>
                  <Link href={`/packages/${pkg!.slug}/docs/${doc.slug}`} className={styles.tocItemLink}>
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {sortedCategories.map((cat) => {
            const catDocs = docsByCategory[cat.id] || [];
            if (catDocs.length === 0) return null;
            return (
              <div key={cat.id} style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", textTransform: "lowercase", color: "var(--muted)", marginBottom: "4px" }}>
                  {cat.title}
                </div>
                <ul className={styles.tocList}>
                  {catDocs.map((doc) => (
                    <li key={doc.id} className={styles.tocItem}>
                      <Link href={`/packages/${pkg!.slug}/docs/${doc.slug}`} className={styles.tocItemLink}>
                        {doc.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
