import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "./packageLayout.module.css";
import { getPackage } from "../../../lib/data";


export default async function PackageLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const pkg = await getPackage(params.slug);
  if (!pkg) notFound();

  const sortedCategories = [...pkg.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  const sortedDocs = [...pkg.docsList].sort((a, b) => a.displayOrder - b.displayOrder);

  const uncategorizedDocs = sortedDocs.filter((doc: { categoryId: string | null }) => !doc.categoryId);
  const docsByCategory = sortedCategories.reduce((acc, cat) => {
    acc[cat.id] = sortedDocs.filter((doc: { categoryId: string | null }) => doc.categoryId === cat.id);
    return acc;
  }, {} as Record<string, typeof sortedDocs>);

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.packageTitle}>
          <Link href={`/packages/${pkg.slug}`} className={styles.packageLink}>
            {pkg.name}
          </Link>
        </div>

        <ul className={styles.metaList}>
          <li className={styles.metaItem}>Version: {pkg.latestVersion}</li>
          {pkg.nugetUrl && (
            <li className={styles.metaItem}>
              <a href={pkg.nugetUrl} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
                NuGet
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
                GitHub
              </a>
            </li>
          )}
          {(pkg.docs || pkg.docsList.length > 0) && (
            <li className={styles.metaItem}>
              <Link href={`/packages/${pkg.slug}/docs`} className={styles.metaLink}>
                Documentation
              </Link>
            </li>
          )}
        </ul>

        <div className={styles.tocSection}>
          <div className={styles.tocTitle}>Documentation</div>

          {uncategorizedDocs.length > 0 && (
            <ul className={`${styles.tocList} ${styles.tocGroup}`}>
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
              <div key={cat.id} className={styles.tocGroup}>
                <div className={styles.tocCategoryTitle}>
                  {cat.title}
                </div>
                <ul className={styles.tocList}>
                  {catDocs.map((doc: { id: string; slug: string; title: string }) => (
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
