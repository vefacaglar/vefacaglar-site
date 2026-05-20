import Link from 'next/link';
import { MDXRemote } from "next-mdx-remote/rsc";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
}

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  let page: PageItem | null = null;
  let posts: PostItem[] = [];

  try {
    const pageRes = await fetch(`${API_URL}/api/pages/home`, {
      cache: "no-store",
    });
    if (pageRes.ok) {
      page = await pageRes.json();
    }
  } catch (error) {
    console.error("Failed to fetch home page:", error);
  }

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      cache: "no-store",
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch homepage blog posts:", error);
  }

  // Get the 3 latest posts
  const latestPosts = posts.slice(0, 3);

  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>{page?.title || "Vefa Çağlar"}</h1>
      
      {page?.content && (
        <div style={{ marginBottom: "32px" }}>
          <MDXRemote source={page.content} />
        </div>
      )}

      <h2 style={{ margin: "48px 0 16px 0" }}>Writings</h2>
      {latestPosts.length === 0 ? (
        <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No posts published yet.</p>
      ) : (
        <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
          {latestPosts.map((post) => (
            <li key={post.id} style={{ marginBottom: "16px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "var(--muted)" }}>—</span>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
      )}
      
      <div style={{ marginTop: "48px" }}>
        <Link href="/blog">View all writings</Link>
      </div>
    </div>
  );
}
