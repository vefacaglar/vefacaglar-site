import Link from 'next/link';
import BackButton from "../components/BackButton";
import styles from "./blog.module.css";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  author?: {
    username: string;
    displayName: string;
  } | null;
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
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div>
      <div className={styles.back}>
        <BackButton />
      </div>
      <h1>Blog</h1>
      <p className={styles.subtitle}>Writing about technical decisions and game development.</p>

      {posts.length === 0 ? (
        <p className={styles.empty}>No posts published yet.</p>
      ) : (
        <ul className={styles.list}>
          {posts.map((post) => (
            <li key={post.id} className={styles.listItem}>
              <span className={styles.dash}>—</span>
              <div className={styles.itemMeta}>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
                <div className={styles.date}>
                  {post.publishedAt && (
                    <span>{formatDate(post.publishedAt)}</span>
                  )}
                  {post.author && (
                    <span className={styles.author}>
                      {" — "}
                      <Link href={`/author/${post.author.username}`}>
                        {post.author.displayName}
                      </Link>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
