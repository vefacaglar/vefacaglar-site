import { cache } from "react";
import { unstable_cache } from "next/cache";
import { httpClient } from "./httpClient";
import { getActiveLanguage } from "./lang";
import { PUBLIC_CONTENT_TAG } from "./cacheTags";

// Safety net for changes made outside the dashboard (e.g. Drizzle Studio), which
// never call revalidateTag. Dashboard mutations invalidate PUBLIC_CONTENT_TAG instantly.
const FALLBACK_REVALIDATE_SECONDS = 3600;

// Only a real 404 from the API means "this content does not exist". Any other
// failure (5xx, timeout, connection refused) is thrown so the page renders the
// error boundary with a 5xx instead of a 404 — otherwise a short API outage would
// tell search engines that every post was deleted.
async function fetchJson<T = any>(path: string, lang: string): Promise<T | null> {
  const res = await httpClient.get(path, { headers: { language: lang } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Data fetch failed for ${path}: ${res.status}`);
  }
  return (await res.json()) as T;
}

// Responses are cached per path + language in the Next data cache. Errors are
// thrown and therefore never cached.
const cachedFetchJson = unstable_cache(fetchJson, ["public-api"], {
  tags: [PUBLIC_CONTENT_TAG],
  revalidate: FALLBACK_REVALIDATE_SECONDS,
});

function getJson<T = any>(path: string, { cached = true }: { cached?: boolean } = {}) {
  const lang = getActiveLanguage();
  return cached ? cachedFetchJson(path, lang) as Promise<T | null> : fetchJson<T>(path, lang);
}

export const getHomePage = cache(() => getJson("/api/pages/home"));

export const getPage = cache((slug: string) => getJson(`/api/pages/${slug}`));

export const getPost = cache((slug: string) => getJson(`/api/posts/${slug}`));

export const getProject = cache((slug: string) => getJson(`/api/projects/${slug}`));

export const getPackage = cache((slug: string) => getJson(`/api/packages/${slug}`));

export const getPackageItem = cache((groupSlug: string, packageSlug: string) =>
  getJson(`/api/packages/${groupSlug}/${packageSlug}`)
);

export const getPackageDoc = cache((slug: string, docSlug: string) =>
  getJson(`/api/packages/${slug}/docs/${docSlug}`)
);

export const getAuthor = cache((username: string) => getJson(`/api/authors/${username}`));

export const getPublicPosts = cache((page: number, q?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (q) params.set("q", q);
  // Free-text searches are not cached: every distinct query would add a cache entry.
  return getJson(`/api/posts?${params.toString()}`, { cached: !q });
});

export const getFeedPosts = cache(() => getJson("/api/posts?page=1&limit=20"));

export const getPublicProjects =cache((page: number) =>
  getJson(`/api/projects?page=${page}&limit=10`)
);

export const getPublicPackages = cache((page: number) =>
  getJson(`/api/packages?page=${page}&limit=10`)
);
