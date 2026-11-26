import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizedAlternates } from "../../../../lib/seo";
import { getPackageItem } from "../../../../lib/data";
import { resolvePackageDescription, stripLeadingDuplicateHeading } from "../../../../lib/packageSeo";
import MarkdownPreview from "../../../components/MarkdownPreview";
import styles from "../packagePage.module.css";
import { safeExternalUrl } from "../../../../lib/safeExternalUrl";


export async function generateMetadata(props: { params: Promise<{ slug: string; packageSlug: string }> }) {
  const params = await props.params;
  const pkg = await getPackageItem(params.slug, params.packageSlug);
  if (!pkg) return { title: "Package Not Found" };

  const title = `${pkg.name} | ${pkg.groupName}`;
  const description = resolvePackageDescription(
    pkg.description,
    pkg.content,
    `Package details for ${pkg.name}`
  );

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: localizedAlternates(`/packages/${params.slug}/${params.packageSlug}`, await getActiveLanguage(), {
      bilingual: false,
    }),
  };
}

export default async function PackageItemPage(props: { params: Promise<{ slug: string; packageSlug: string }> }) {
  const params = await props.params;
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
      {pkg.description && (
        <p className={styles.description}>{pkg.description}</p>
      )}

      <section className={styles.packageList}>
        <h2 className={styles.sectionTitle}>Details</h2>
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt>Group</dt>
            <dd>
              <Link href={`/packages/${pkg.groupSlug}`}>{pkg.groupName}</Link>
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Version</dt>
            <dd>{pkg.latestVersion}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Slug</dt>
            <dd>{pkg.slug}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.packageList}>
        <h2 className={styles.sectionTitle}>Links</h2>
        <div className={styles.links}>
          {safeExternalUrl(pkg.nugetUrl) && (
            <a href={safeExternalUrl(pkg.nugetUrl)} target="_blank" rel="noopener noreferrer">
              nuget
            </a>
          )}
          {safeExternalUrl(pkg.npmUrl) && (
            <a href={safeExternalUrl(pkg.npmUrl)} target="_blank" rel="noopener noreferrer">
              npm
            </a>
          )}
          {safeExternalUrl(pkg.githubUrl) && (
            <a href={safeExternalUrl(pkg.githubUrl)} target="_blank" rel="noopener noreferrer">
              github
            </a>
          )}
          {!safeExternalUrl(pkg.nugetUrl) && !safeExternalUrl(pkg.npmUrl) && !safeExternalUrl(pkg.githubUrl) && <p className={styles.emptyText}>No package links available.</p>}
        </div>
      </section>

      {pkg.content ? (
        <div className={styles.contentWrapper}>
          <MarkdownPreview content={stripLeadingDuplicateHeading(pkg.content, pkg.name)} demoteHeadings />
        </div>
      ) : (
        <p className={styles.emptyText}>No package details available.</p>
      )}
    </div>
  );
}
