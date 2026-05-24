import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../components/MarkdownPreview";
import { getActiveLanguage } from "../../lib/lang";
import { httpClient } from "../../lib/httpClient";
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
  try {
    const res = await httpClient.get(`/api/pages/${params.slug}`);
    if (!res.ok) return { title: "Page Not Found" };

    const page: PageItem = await res.json();
    return {
      title: page.seoTitle || `${page.title} | Vefa Çağlar`,
      description: page.seoDescription || page.title,
    };
  } catch {
    return { title: "Vefa Çağlar" };
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
