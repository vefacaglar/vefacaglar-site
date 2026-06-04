import Link from 'next/link';
import MarkdownPreview from "./components/MarkdownPreview";
import styles from "./home.module.css";
import { getActiveLanguage } from '../lib/lang';
import { getDictionary, formatMetaTitle } from '../dictionaries';
import { localizeHref } from '../lib/localizeHref';
import { localizedAlternates } from '../lib/seo';
import { getHomePage, getPublicPosts } from '../lib/data';

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
}


export async function generateMetadata() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const page = await getHomePage();

  return {
    title: page?.seoTitle || page?.title || dict.site_title,
    description: page?.seoDescription || dict.site_description,
    alternates: localizedAlternates("", lang),
  };
}

export default async function Home() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  const [page, postsRes] = await Promise.all([
    getHomePage(),
    getPublicPosts(1),
  ]);

  const posts: PostItem[] = (postsRes?.items ?? []) as PostItem[];
  const latestPosts = posts.slice(0, 3);

  return (
    <div>
      <h1 className={styles.title}>{page?.title || dict.site_title}</h1>

      {page?.content && (
        <div className={styles.content}>
          <MarkdownPreview content={page.content} />
        </div>
      )}

      <h2 className={styles.writingsHeading}>{dict.writings}</h2>
      {latestPosts.length === 0 ? (
        <p className={styles.empty}>{dict.no_posts}</p>
      ) : (
        <ul className={styles.list}>
          {latestPosts.map((post) => (
            <li key={post.id} className={styles.listItem}>
              <span className={styles.dash}>{dict.separator_dash}</span>
              <Link href={localizeHref(`/blog/${post.slug}`, lang)}>{post.title}</Link>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.viewAll}>
        <Link href={localizeHref("/blog", lang)}>{dict.view_all}</Link>
      </div>
    </div>
  );
}
