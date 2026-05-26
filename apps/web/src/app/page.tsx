import Link from 'next/link';
import MarkdownPreview from "./components/MarkdownPreview";
import styles from "./home.module.css";
import { getActiveLanguage } from '../lib/lang';
import { getDictionary } from '../dictionaries';
import { localizeHref } from '../lib/localizeHref';
import { httpClient } from '../lib/httpClient';

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  let page: PageItem | null = null;

  try {
    const res = await httpClient.get("/api/pages/home", {
      cache: "no-store",
    });
    if (res.ok) {
      page = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch home page metadata:", error);
  }

  return {
    title: page?.seoTitle || page?.title || "vefa çağlar",
    description: page?.seoDescription || "personal website of vefa çağlar",
  };
}

export default async function Home() {
  let page: PageItem | null = null;
  let posts: PostItem[] = [];
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const pageRes = await httpClient.get("/api/pages/home", {
      cache: "no-store",
    });
    if (pageRes.ok) {
      page = await pageRes.json();
    }
  } catch (error) {
    console.error("Failed to fetch home page:", error);
  }

  try {
    const res = await httpClient.get("/api/posts", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      posts = Array.isArray(data) ? data : data.items;
    }
  } catch (error) {
    console.error("Failed to fetch homepage blog posts:", error);
  }

  const latestPosts = posts.slice(0, 3);

  return (
    <div>
      <h1 className={styles.title}>{page?.title || "vefa çağlar"}</h1>
      
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
              <span className={styles.dash}>—</span>
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
