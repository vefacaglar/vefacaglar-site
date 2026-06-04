import Link from 'next/link';
import styles from "./blog.module.css";
import { getActiveLanguage } from '../../lib/lang';
import { getDictionary } from '../../dictionaries';
import { localizeHref } from '../../lib/localizeHref';
import Pagination from '../components/Pagination';
import { localizedAlternates } from '../../lib/seo';
import { getPublicPosts } from '../../lib/data';
import BlogSearch from './BlogSearch';


export async function generateMetadata() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  return {
    title: dict.blog_meta_title,
    alternates: localizedAlternates("/blog", lang),
  };
}

interface BlogProps {
  searchParams: {
    page?: string;
    q?: string;
  };
}

export default async function Blog({ searchParams }: BlogProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const query = searchParams.q || "";
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  const data = await getPublicPosts(page, query || undefined);
  const posts = (data?.items ?? []) as {
    id: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    publishedAt?: string | null;
    createdAt: string;
    author?: { username: string; displayName: string } | null;
  }[];
  const totalPages = data?.totalPages ?? 0;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  return (
    <div>
      <h1>{dict.blog}</h1>
      <p className={styles.subtitle}>{dict.blog_subtitle}</p>

      <BlogSearch initialQuery={query} />

      {posts.length === 0 ? (
        <p className={styles.noResults}>{query ? dict.no_results : dict.no_posts}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {posts.map((post) => (
              <li key={post.id} className={styles.listItem}>
                <span className={styles.dash}>{dict.separator_dash}</span>
                <div className={styles.itemMeta}>
                  <Link href={localizeHref(`/blog/${post.slug}`, lang)}>{post.title}</Link>
                  {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}
                  <div className={styles.date}>
                    {post.publishedAt && (
                      <span>{formatDate(post.publishedAt)}</span>
                    )}
                    {post.author && (
                      <span className={styles.author}>
                        {" "}{dict.separator_dash}{" "}
                        <Link href={localizeHref(`/author/${post.author.username}`, lang)}>
                          {post.author.displayName}
                        </Link>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
