import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../components/MarkdownPreview";
import { httpClient } from "../../lib/httpClient";

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
        <h1 style={{ marginBottom: "24px" }}>{page.title}</h1>
        {page.content && (
          <MarkdownPreview content={page.content} />
        )}
      </article>
    </div>
  );
}
