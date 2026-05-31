import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../../../components/MarkdownPreview";
import { httpClient } from "../../../../../lib/httpClient";
import { getActiveLanguage } from "../../../../../lib/lang";
import { localizedAlternates } from "../../../../../lib/seo";
import styles from "./docPage.module.css";

interface DocDetail {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  displayOrder: number;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string; docSlug: string } }) {
  try {
    const res = await httpClient.get(`/api/packages/${params.slug}/docs/${params.docSlug}`);
    if (!res.ok) return { title: "Documentation Page Not Found" };
    const doc: DocDetail = await res.json();
    return {
      title: `${doc.title} - Documentation`,
      description: doc.description || `Documentation article for ${doc.title}`,
      alternates: localizedAlternates(
        `/packages/${params.slug}/docs/${params.docSlug}`,
        getActiveLanguage(),
        { bilingual: false }
      ),
    };
  } catch {
    return { title: "Documentation" };
  }
}

export default async function DocPage({ params }: { params: { slug: string; docSlug: string } }) {
  let doc: DocDetail | null = null;

  try {
    const res = await httpClient.get(`/api/packages/${params.slug}/docs/${params.docSlug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      doc = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch doc details for page:", error);
  }

  if (!doc) {
    notFound();
  }

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
