import React from "react";
import BackButton from "../../components/BackButton";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";

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
}

export const dynamic = "force-dynamic";

// Dynamic SEO Metadata Generation
export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const res = await fetch(`${API_URL}/api/posts/${params.slug}`);
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

  try {
    const res = await fetch(`${API_URL}/api/posts/${params.slug}`, {
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
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <article>
      <div style={{ marginBottom: "48px" }}>
        <BackButton />
      </div>

      <header style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", marginBottom: "8px", lineHeight: "1.3" }}>{post.title}</h1>
        {post.publishedAt && (
          <div style={{ fontSize: "14px", color: "var(--muted)" }}>
            {formatDate(post.publishedAt)}
          </div>
        )}
      </header>

      {post.coverImageUrl && (
        <div style={{ marginBottom: "32px" }}>
          <img
            src={post.coverImageUrl}
            alt={post.title}
            style={{ width: "100%", height: "auto", borderRadius: "4px" }}
          />
        </div>
      )}

      {/* Render Markdown Content */}
      <div style={{ lineHeight: "1.7", fontSize: "15px" }}>
        <MarkdownPreview content={post.content} />
      </div>
    </article>
  );
}
