import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../components/MarkdownPreview";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../dictionaries";
import { localizedAlternates } from "../../lib/seo";
import styles from "./page.module.css";
import AdminEditLink from "../../components/AdminEditLink";
import { localizeHref } from "../../lib/localizeHref";
import { getPage } from "../../lib/data";


export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const page = await getPage(params.slug);

  if (!page) return { title: dict.page_not_found_title };

  return {
    title: page.seoTitle || formatMetaTitle(page.title, lang),
    description: page.seoDescription || page.title,
    alternates: localizedAlternates(`/${params.slug}`, lang),
  };
}

export default async function DynamicPage({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const page = await getPage(params.slug);

  if (!page) notFound();

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
