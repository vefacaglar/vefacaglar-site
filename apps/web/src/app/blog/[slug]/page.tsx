import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import styles from "./post.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { httpClient } from "../../../lib/httpClient";

interface PostDetail {
  id: string;
  slug: string;
  title: string;
  content: string;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  author?: {
    username: string;
    displayName: string;
  } | null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const res = await httpClient.get(`/api/posts/${params.slug}`);
    if (!res.ok) return { title: "Post Not Found" };

    const post: PostDetail = await res.json();
    return {
      title: post.seoTitle || `${post.title} | Vefa Çağlar`,
      description: post.seoDescription || post.title,
    };
  } catch {
    return { title: "Vefa Çağlar Blog" };
  }
}

export default async function BlogPost({ params }: { params: { slug: string } }) {
  let post: PostDetail | null = null;
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/posts/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      post = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch blog post by slug:", error);
  }

  if (!post) {
    notFound();
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <article>
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
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className={styles.coverImg}
          />
        </div>
      )}

      <div className={styles.body}>
        <MarkdownPreview content={post.content} />
      </div>
    </article>
  );
}
