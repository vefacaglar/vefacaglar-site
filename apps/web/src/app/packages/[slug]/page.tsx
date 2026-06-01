import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import MarkdownPreview from "../../components/MarkdownPreview";
import { getActiveLanguage } from "../../../lib/lang";
import { localizedAlternates } from "../../../lib/seo";
import styles from "./packagePage.module.css";
import { getPackage } from "../../../lib/data";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const pkg = await getPackage(params.slug);
  if (!pkg) return { title: "Package Not Found" };

  return {
    title: `${pkg.name} | Package`,
    description: pkg.description || `Documentation and details for ${pkg.name}`,
    alternates: localizedAlternates(`/packages/${params.slug}`, getActiveLanguage(), {
      bilingual: false,
    }),
  };
}

export default async function PackagePage({ params }: { params: { slug: string } }) {
  const pkg = await getPackage(params.slug);
  if (!pkg) notFound();

  return (
    <div>
      <h1 className={styles.title}>
        {pkg.name}
      </h1>

      {pkg.description && (
        <p className={styles.description}>
          {pkg.description}
        </p>
      )}

      {pkg.packages && pkg.packages.length > 0 && (
        <section className={styles.packageList}>
          <h2 className={styles.sectionTitle}>Packages</h2>
          <ul className={styles.packageItems}>
            {pkg.packages.map((item: any) => (
              <li key={item.id} className={styles.packageItem}>
                <div>
                  <Link href={`/packages/${pkg.slug}/${item.slug}`} className={styles.packageItemLink}>
                    {item.name}
                  </Link>
                  <span className={styles.version}>v{item.latestVersion}</span>
                </div>
                <div className={styles.links}>
                  {item.nugetUrl && (
                    <a href={item.nugetUrl} target="_blank" rel="noopener noreferrer">
                      nuget
                    </a>
                  )}
                  {item.npmUrl && (
                    <a href={item.npmUrl} target="_blank" rel="noopener noreferrer">
                      npm
                    </a>
                  )}
                  {item.githubUrl && (
                    <a href={item.githubUrl} target="_blank" rel="noopener noreferrer">
                      github
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pkg.content ? (
        <div className={styles.contentWrapper}>
          <MarkdownPreview content={pkg.content} />
        </div>
      ) : (
        <p className={styles.emptyText}>No overview available for this package.</p>
      )}
    </div>
  );
}
