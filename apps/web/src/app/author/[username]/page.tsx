import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { httpClient } from "../../../lib/httpClient";
import { localizedAlternates } from "../../../lib/seo";

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
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/authors/${params.username}`);
    if (!res.ok) return { title: dict.author_not_found_title };

    const author: AuthorDetail = await res.json();
    return {
      title: formatMetaTitle(author.displayName, lang),
      description: `${dict.posts_by} ${author.displayName}`,
      alternates: localizedAlternates(`/author/${params.username}`, lang),
    };
  } catch {
    return { title: dict.author_meta_title };
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
              <span className={styles.dash}>{dict.separator_dash}</span>
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
