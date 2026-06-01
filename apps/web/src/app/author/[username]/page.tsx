import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { localizedAlternates } from "../../../lib/seo";
import { getAuthor } from "../../../lib/data";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: { username: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const author = await getAuthor(params.username);

  if (!author) return { title: dict.author_not_found_title };

  return {
    title: formatMetaTitle(author.displayName, lang),
    description: `${dict.posts_by} ${author.displayName}`,
    alternates: localizedAlternates(`/author/${params.username}`, lang),
  };
}

export default async function AuthorPage({ params }: { params: { username: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const author = await getAuthor(params.username);

  if (!author) notFound();

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
          {author.posts.map((post: { id: string; slug: string; title: string; excerpt: string | null; publishedAt: string | null }) => (
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
