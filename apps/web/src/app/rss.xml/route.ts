import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { SITE_URL } from "../../lib/seo";
import { getFeedPosts } from "../../lib/data";

type FeedPost = {
  slug: string;
  title: string;
  excerpt?: string | null;
  seoDescription?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  author?: { displayName: string } | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Served at /rss.xml (English) and /rss.xml?lang=tr (Turkish).
export async function GET() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const data = await getFeedPosts();
  const posts = (data?.items ?? []) as FeedPost[];

  const blogUrl = `${SITE_URL}${localizeHref("/blog", lang)}`;
  const feedUrl = `${SITE_URL}${localizeHref("/rss.xml", lang)}`;

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}${localizeHref(`/blog/${post.slug}`, lang)}`;
      const date = new Date(post.publishedAt ?? post.createdAt).toUTCString();
      const summary = post.excerpt || post.seoDescription;
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${date}</pubDate>`,
        summary ? `      <description>${escapeXml(summary)}</description>` : null,
        post.author ? `      <dc:creator>${escapeXml(post.author.displayName)}</dc:creator>` : null,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(dict.blog_meta_title)}</title>
    <link>${blogUrl}</link>
    <description>${escapeXml(dict.blog_subtitle)}</description>
    <language>${lang}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
