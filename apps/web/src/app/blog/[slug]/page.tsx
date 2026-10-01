import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import styles from "./post.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { localizedAlternates, SITE_URL } from "../../../lib/seo";
import AdminEditLink from "../../../components/AdminEditLink";
import { getPost } from "../../../lib/data";


export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const post = await getPost(params.slug);

  if (!post) return { title: dict.post_not_found_title };

  return {
    title: post.seoTitle || formatMetaTitle(post.title, lang),
    description: post.seoDescription || post.title,
    alternates: localizedAlternates(`/blog/${params.slug}`, lang),
    openGraph: {
      type: "article",
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.title,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt ?? undefined,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const post = await getPost(params.slug);

  if (!post) notFound();

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.title,
    inLanguage: lang,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    mainEntityOfPage: `${SITE_URL}${localizeHref(`/blog/${post.slug}`, lang)}`,
    author: post.author ? { "@type": "Person", name: post.author.displayName } : undefined,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className={styles.header}>
        <h1 className={styles.postTitle}>{post.title}</h1>
        {post.publishedAt && (
          <div className={styles.date}>
            {formatDate(post.publishedAt)}
          </div>
        )}
        {post.author && (
          <div className={styles.author}>
            {dict.by}{" "}
            <Link href={localizeHref(`/author/${post.author.username}`, lang)}>
              {post.author.displayName}
            </Link>
          </div>
        )}
      </header>

      {post.coverImageUrl && (
        <div className={styles.cover}>
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            width={1280}
            height={720}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className={styles.coverImg}
          />
        </div>
      )}

      <div className={styles.body}>
        <MarkdownPreview content={post.content} />
      </div>
      {post.id && (
        <AdminEditLink type="post" id={post.id} from={localizeHref(`/blog/${post.slug}`, lang)} />
      )}
    </article>
  );
}
