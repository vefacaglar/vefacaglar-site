import Link from 'next/link';
import BackButton from "../components/BackButton";
import MarkdownPreview from "../components/MarkdownPreview";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  let page: PageItem | null = null;

  try {
    const res = await fetch(`${API_URL}/api/pages/about`, {
      cache: "no-store",
    });
    if (res.ok) {
      page = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch about page metadata:", error);
  }

  return {
    title: page?.seoTitle || page?.title || "About",
    description: page?.seoDescription || "About Vefa Çağlar",
  };
}

export default async function About() {
  let page: PageItem | null = null;

  try {
    const pageRes = await fetch(`${API_URL}/api/pages/about`, {
      cache: "no-store",
    });
    if (pageRes.ok) {
      page = await pageRes.json();
    }
  } catch (error) {
    console.error("Failed to fetch about page:", error);
  }

  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <BackButton />
      </div>
      <h1>{page?.title || "About"}</h1>
      {page?.content && (
        <MarkdownPreview content={page.content} />
      )}
    </div>
  );
}
