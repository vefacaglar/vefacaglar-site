import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../../../components/MarkdownPreview";
import { getActiveLanguage } from "../../../../../lib/lang";
import { localizedAlternates } from "../../../../../lib/seo";
import styles from "./docPage.module.css";
import { getPackageDoc } from "../../../../../lib/data";


export async function generateMetadata({ params }: { params: { slug: string; docSlug: string } }) {
  const doc = await getPackageDoc(params.slug, params.docSlug);
  if (!doc) return { title: "Documentation Page Not Found" };

  return {
    title: `${doc.title} - Documentation`,
    description: doc.description || `Documentation article for ${doc.title}`,
    alternates: localizedAlternates(
      `/packages/${params.slug}/docs/${params.docSlug}`,
      getActiveLanguage(),
      { bilingual: false }
    ),
  };
}

export default async function DocPage({ params }: { params: { slug: string; docSlug: string } }) {
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
        <MarkdownPreview content={doc.content} />
      </div>
    </div>
  );
}
