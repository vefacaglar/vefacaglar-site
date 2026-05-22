import React from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import styles from "./post.module.css";
import { getActiveLanguage } from "../../../lib/lang";

const API_URL = process.env.API_URL || "http://localhost:3001";

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

// Dynamic SEO Metadata Generation
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  try {
    const res = await fetch(`${API_URL}/api/posts/${params.slug}`, {
      headers: {
        language: lang,
      },
    });
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

  try {
    const res = await fetch(`${API_URL}/api/posts/${params.slug}`, {
      cache: "no-store",
      headers: {
        language: lang,
      },
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
      <div className={styles.back}>
        <BackButton />
      </div>

      <header className={styles.header}>
        <h1 className={styles.postTitle}>{post.title}</h1>
        {post.publishedAt && (
          <div className={styles.date}>
            {formatDate(post.publishedAt)}
          </div>
        )}
        {post.author && (
          <div className={styles.author}>
            {lang === "tr" ? "yazar: " : "by "}
            <Link href={`/author/${post.author.username}`}>
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

      {/* Render Markdown Content */}
      <div className={styles.body}>
        <MarkdownPreview content={post.content} />
      </div>
    </article>
  );
}
