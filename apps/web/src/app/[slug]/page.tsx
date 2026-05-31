import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../components/MarkdownPreview";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../dictionaries";
import { httpClient } from "../../lib/httpClient";
import { localizedAlternates } from "../../lib/seo";
import styles from "./page.module.css";
import AdminEditLink from "../../components/AdminEditLink";
import { localizeHref } from "../../lib/localizeHref";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: "draft" | "published";
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/pages/${params.slug}`);
    if (!res.ok) return { title: dict.page_not_found_title };

    const page: PageItem = await res.json();
    return {
      title: page.seoTitle || formatMetaTitle(page.title, lang),
      description: page.seoDescription || page.title,
      alternates: localizedAlternates(`/${params.slug}`, lang),
    };
  } catch {
    return { title: dict.site_title };
  }
}

export default async function DynamicPage({ params }: { params: { slug: string } }) {
  let page: PageItem | null = null;
  const lang = getActiveLanguage();

  try {
    const res = await httpClient.get(`/api/pages/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      page = await res.json();
    }
  } catch (error) {
    console.error(`Failed to fetch dynamic page by slug (${params.slug}):`, error);
  }

  if (!page) {
    notFound();
  }

  return (
    <div>
      <article>
        <h1 className={styles.title}>{page.title}</h1>
        {page.content && (
          <MarkdownPreview content={page.content} />
        )}
        {page.id && (
          <AdminEditLink type="page" id={page.id} from={localizeHref(`/${page.slug}`, lang)} />
        )}
      </article>
    </div>
  );
}
