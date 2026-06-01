import { MetadataRoute } from "next";

export const runtime = "edge";

const apiUrl = process.env.API_URL;

if (!apiUrl) {
  throw new Error("API_URL environment variable is not set.");
}
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vefacaglar.com";

type Entry = MetadataRoute.Sitemap[number];

// Return the first parseable date among the candidates, or undefined if none is valid.
function parseDate(...candidates: Array<string | undefined | null>): Date | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!isNaN(date.getTime())) return date;
  }
  return undefined;
}

// Emit the same entry for both the English and Turkish (/tr) variants of a path.
function bilingual(path: string, options: Omit<Entry, "url">): Entry[] {
  return [
    { url: `${baseUrl}${path}`, ...options },
    { url: `${baseUrl}/tr${path}`, ...options },
  ];
}

// Emit a single English-only entry (sections without a Turkish translation).
function englishOnly(path: string, options: Omit<Entry, "url">): Entry[] {
  return [{ url: `${baseUrl}${path}`, ...options }];
}

async function fetchJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error(`Sitemap: failed to fetch ${path}:`, error);
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: Entry[] = [
    ...bilingual("", { lastModified: now, changeFrequency: "daily", priority: 1.0 }),
    ...bilingual("/about", { lastModified: now, changeFrequency: "monthly", priority: 0.8 }),
    ...bilingual("/blog", { lastModified: now, changeFrequency: "daily", priority: 0.9 }),
    ...bilingual("/projects", { lastModified: now, changeFrequency: "weekly", priority: 0.8 }),
    ...englishOnly("/packages", { lastModified: now, changeFrequency: "weekly", priority: 0.8 }),
  ];

  const [postsData, pages, packagesData] = await Promise.all([
    fetchJson("/api/posts?limit=1000"),
    fetchJson("/api/pages"),
    fetchJson("/api/packages"),
  ]);

  const dynamicRoutes: Entry[] = [];

  for (const post of postsData?.items ?? []) {
    dynamicRoutes.push(
      ...bilingual(`/blog/${post.slug}`, {
        lastModified: parseDate(post.updatedAt, post.publishedAt, post.createdAt) ?? now,
        changeFrequency: "monthly",
        priority: 0.7,
      })
    );
  }

  const excludedSlugs = ["about", "home"];
  for (const page of pages ?? []) {
    if (excludedSlugs.includes(page.slug) || page.status !== "published") continue;
    dynamicRoutes.push(
      ...bilingual(`/${page.slug}`, {
        lastModified: parseDate(page.updatedAt, page.publishedAt, page.createdAt) ?? now,
        changeFrequency: "monthly",
        priority: 0.6,
      })
    );
  }

  for (const pkg of packagesData?.items ?? []) {
    dynamicRoutes.push(
      ...englishOnly(`/packages/${pkg.slug}`, {
        lastModified: parseDate(pkg.updatedAt, pkg.createdAt) ?? now,
        changeFrequency: "monthly",
        priority: 0.6,
      })
    );
  }

  // Deduplicate by URL so a dynamic page slug can't collide with a static route.
  const seen = new Set<string>();
  return [...staticRoutes, ...dynamicRoutes].filter((entry) =>
    seen.has(entry.url) ? false : seen.add(entry.url)
  );
}
