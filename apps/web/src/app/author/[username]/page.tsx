import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { httpClient } from "../../../lib/httpClient";

interface AuthorDetail {
  username: string;
  displayName: string;
  posts: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    publishedAt: string | null;
  }[];
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { username: string } }) {
  try {
    const res = await httpClient.get(`/api/authors/${params.username}`);
    if (!res.ok) return { title: "Author Not Found" };

    const author: AuthorDetail = await res.json();
    return {
      title: `${author.displayName} | Vefa Çağlar`,
      description: `Posts by ${author.displayName}`,
    };
  } catch {
    return { title: "Author | Vefa Çağlar" };
  }
}

export default async function AuthorPage({ params }: { params: { username: string } }) {
  let author: AuthorDetail | null = null;
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/authors/${params.username}`, {
      cache: "no-store",
    });
    if (res.ok) {
      author = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch author:", error);
  }

  if (!author) {
    notFound();
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div>
      <h1 className={styles.authorName}>{author.displayName}</h1>
      <p className={styles.username}>@{author.username}</p>

      <h2 className={styles.sectionTitle}>{dict.posts}</h2>

      {author.posts.length === 0 ? (
        <p className={styles.empty}>{dict.no_posts_by_author}</p>
      ) : (
        <ul className={styles.list}>
          {author.posts.map((post) => (
            <li key={post.id} className={styles.listItem}>
              <span className={styles.dash}>—</span>
              <div className={styles.itemMeta}>
                <Link href={localizeHref(`/blog/${post.slug}`, lang)}>{post.title}</Link>
                {post.excerpt && (
                  <p className={styles.excerpt}>{post.excerpt}</p>
                )}
                {post.publishedAt && (
                  <span className={styles.date}>
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
