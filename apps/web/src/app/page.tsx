import Link from 'next/link';

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  let posts: PostItem[] = [];

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
      <h1 style={{ marginBottom: "32px" }}>Vefa Çağlar</h1>
      
      <p style={{ marginBottom: "32px" }}>
        I'm a software engineer and indie game developer. I write about backend systems, game development, tools, and technical decisions from the projects I work on.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "48px" }}>
        <Link href="/about">About</Link>
        <a href="https://linkedin.com">LinkedIn</a>
        <a href="https://x.com">X (Twitter)</a>
        <a href="https://github.com">GitHub</a>
      </div>

      <h2 style={{ margin: "48px 0 16px 0" }}>Current Project</h2>
      <p style={{ marginBottom: "48px" }}>
        <strong>Wastecross:</strong> a post-apocalyptic top-down action RPG about reopening roads between fractured zones in Unity.
      </p>

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
