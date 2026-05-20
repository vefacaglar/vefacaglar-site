import Link from 'next/link';

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function Blog() {
  let posts: PostItem[] = [];

  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      cache: "no-store",
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch public blog posts:", error);
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← back</Link>
      </div>
      <h1>Blog</h1>
      <p style={{ color: "var(--muted)", marginBottom: "32px" }}>Writing about technical decisions and game development.</p>

      {posts.length === 0 ? (
        <p style={{ color: "var(--muted)", fontStyle: "italic" }}>Henüz yazı yayınlanmadı.</p>
      ) : (
        <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
          {posts.map((post) => (
            <li key={post.id} style={{ marginBottom: "24px", paddingLeft: "20px", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color: "var(--muted)" }}>—</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                {post.excerpt && <p style={{ fontSize: "14px", margin: "4px 0", color: "var(--text)" }}>{post.excerpt}</p>}
                {post.publishedAt && (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {formatDate(post.publishedAt)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
