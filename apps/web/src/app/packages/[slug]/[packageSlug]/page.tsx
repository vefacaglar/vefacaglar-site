import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizedAlternates } from "../../../../lib/seo";
import { getPackageItem } from "../../../../lib/data";
import MarkdownPreview from "../../../components/MarkdownPreview";
import styles from "../packagePage.module.css";


export async function generateMetadata({ params }: { params: { slug: string; packageSlug: string } }) {
  const pkg = await getPackageItem(params.slug, params.packageSlug);
  if (!pkg) return { title: "Package Not Found" };

  return {
    title: `${pkg.name} | ${pkg.groupName}`,
    description: pkg.description || `Package details for ${pkg.name}`,
    alternates: localizedAlternates(`/packages/${params.slug}/${params.packageSlug}`, getActiveLanguage(), {
      bilingual: false,
    }),
  };
}

export default async function PackageItemPage({ params }: { params: { slug: string; packageSlug: string } }) {
  const pkg = await getPackageItem(params.slug, params.packageSlug);
  if (!pkg) notFound();

  return (
    <div>
      <div className={styles.backLinkRow}>
        <Link href={`/packages/${pkg.groupSlug}`} className={styles.backLink}>
          back to {pkg.groupName}
        </Link>
      </div>

      <h1 className={styles.title}>{pkg.name}</h1>
      <p className={styles.description}>
        {pkg.description || `Package details for ${pkg.name}.`}
      </p>

      <section className={styles.packageList}>
        <h2 className={styles.sectionTitle}>Details</h2>
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt>group</dt>
            <dd>
              <Link href={`/packages/${pkg.groupSlug}`}>{pkg.groupName}</Link>
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>version</dt>
            <dd>{pkg.latestVersion}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>slug</dt>
            <dd>{pkg.slug}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.packageList}>
        <h2 className={styles.sectionTitle}>Links</h2>
        <div className={styles.links}>
          {pkg.nugetUrl && (
            <a href={pkg.nugetUrl} target="_blank" rel="noopener noreferrer">
              nuget
            </a>
          )}
          {pkg.npmUrl && (
            <a href={pkg.npmUrl} target="_blank" rel="noopener noreferrer">
              npm
            </a>
          )}
          {pkg.githubUrl && (
            <a href={pkg.githubUrl} target="_blank" rel="noopener noreferrer">
              github
            </a>
          )}
          {!pkg.nugetUrl && !pkg.npmUrl && !pkg.githubUrl && <p className={styles.emptyText}>No package links available.</p>}
        </div>
      </section>

      {pkg.content ? (
        <div className={styles.contentWrapper}>
          <MarkdownPreview content={pkg.content} />
        </div>
      ) : (
        <p className={styles.emptyText}>No package details available.</p>
      )}
    </div>
  );
}
