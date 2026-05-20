import Link from 'next/link';
import { MDXRemote } from "next-mdx-remote/rsc";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
}

export const dynamic = "force-dynamic";

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
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← Back</Link>
      </div>
      <h1>{page?.title || "About"}</h1>
      {page?.content && (
        <MDXRemote source={page.content} />
      )}
    </div>
  );
}
