import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../../../components/MarkdownPreview";
import { getActiveLanguage } from "../../../../../lib/lang";
import { localizedAlternates } from "../../../../../lib/seo";
import styles from "./docPage.module.css";
import { getPackageDoc } from "../../../../../lib/data";
import { resolvePackageDescription, stripLeadingDuplicateHeading } from "../../../../../lib/packageSeo";


export async function generateMetadata(props: { params: Promise<{ slug: string; docSlug: string }> }) {
  const params = await props.params;
  const doc = await getPackageDoc(params.slug, params.docSlug);
  if (!doc) return { title: "Documentation Page Not Found" };

  const title = `${doc.title} - Documentation`;
  const description = resolvePackageDescription(
    doc.description,
    doc.content,
    `Documentation article for ${doc.title}`
  );

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: localizedAlternates(
      `/packages/${params.slug}/docs/${params.docSlug}`,
      await getActiveLanguage(),
      { bilingual: false }
    ),
  };
}

export default async function DocPage(props: { params: Promise<{ slug: string; docSlug: string }> }) {
  const params = await props.params;
  const doc = await getPackageDoc(params.slug, params.docSlug);
  if (!doc) notFound();

  return (
    <div>
      <h1 className={styles.title}>
        {doc.title}
      </h1>

      {doc.description && (
        <p className={styles.description}>
          {doc.description}
        </p>
      )}

      <div className={styles.contentWrapper}>
        <MarkdownPreview content={stripLeadingDuplicateHeading(doc.content, doc.title)} demoteHeadings />
      </div>
    </div>
  );
}
