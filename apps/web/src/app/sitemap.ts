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

// Throw on any failure: serving a sitemap that silently dropped the blog/project/package
// URLs would make Google think those pages were removed. A 5xx makes it retry later instead.
async function fetchJson(path: string): Promise<any> {
  const res = await fetch(`${apiUrl}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Sitemap: ${path} responded with ${res.status}`);
  }
  return res.json();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [postsData, pages, projectsData, packagesData] = await Promise.all([
    fetchJson("/api/posts?limit=1000"),
    fetchJson("/api/pages"),
    fetchJson("/api/projects?limit=1000"),
    fetchJson("/api/packages?limit=1000"),
  ]);

  // The list endpoint has no nested items/docs, so load each package's detail.
  const packageDetails: any[] = await Promise.all(
    (packagesData?.items ?? []).map((pkg: { slug: string }) => fetchJson(`/api/packages/${pkg.slug}`))
  );

  const posts: any[] = postsData?.items ?? [];

  // lastModified is only set where a real date exists; a "now" on every request teaches
  // Google to ignore the field.
  const newestPostDate = parseDate(
    ...posts.map((post) => post.updatedAt ?? post.publishedAt ?? post.createdAt)
      .sort()
      .reverse()
  );

  const staticRoutes: Entry[] = [
    ...bilingual("", { changeFrequency: "daily", priority: 1.0 }),
    ...bilingual("/about", { changeFrequency: "monthly", priority: 0.8 }),
    ...bilingual("/blog", { lastModified: newestPostDate, changeFrequency: "daily", priority: 0.9 }),
    ...bilingual("/projects", { changeFrequency: "weekly", priority: 0.8 }),
    ...englishOnly("/packages", { changeFrequency: "weekly", priority: 0.8 }),
  ];

  const dynamicRoutes: Entry[] = [];

  for (const post of posts) {
    dynamicRoutes.push(
      ...bilingual(`/blog/${post.slug}`, {
        lastModified: parseDate(post.updatedAt, post.publishedAt, post.createdAt),
        changeFrequency: "monthly",
        priority: 0.7,
      })
    );
  }

  const authorUsernames = new Set<string>(
    posts.map((post) => post.author?.username).filter(Boolean)
  );
  for (const username of authorUsernames) {
    dynamicRoutes.push(
      ...bilingual(`/author/${username}`, { changeFrequency: "monthly", priority: 0.5 })
    );
  }

  for (const project of projectsData?.items ?? []) {
    dynamicRoutes.push(
      ...bilingual(`/projects/${project.slug}`, {
        lastModified: parseDate(project.updatedAt, project.publishedAt, project.createdAt),
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
        lastModified: parseDate(page.updatedAt, page.publishedAt, page.createdAt),
        changeFrequency: "monthly",
        priority: 0.6,
      })
    );
  }

  // Packages and their docs are English-only.
  for (const pkg of packageDetails) {
    dynamicRoutes.push(
      ...englishOnly(`/packages/${pkg.slug}`, { changeFrequency: "monthly", priority: 0.6 })
    );
    for (const item of pkg.packages ?? []) {
      dynamicRoutes.push(
        ...englishOnly(`/packages/${pkg.slug}/${item.slug}`, {
          changeFrequency: "monthly",
          priority: 0.5,
        })
      );
    }
    for (const doc of pkg.docsList ?? []) {
      dynamicRoutes.push(
        ...englishOnly(`/packages/${pkg.slug}/docs/${doc.slug}`, {
          changeFrequency: "monthly",
          priority: 0.5,
        })
      );
    }
  }

  // Deduplicate by URL so a dynamic page slug can't collide with a static route.
  const seen = new Set<string>();
  return [...staticRoutes, ...dynamicRoutes].filter((entry) =>
    seen.has(entry.url) ? false : seen.add(entry.url)
  );
}
