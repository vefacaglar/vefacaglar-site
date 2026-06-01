import { cache } from "react";
import { httpClient } from "./httpClient";

// Build must not depend on the API being reachable. The web app may be built and
// deployed while the API is still down; once the API comes up, ISR (revalidate)
// regenerates pages with real data. So any fetch failure here — a non-ok response
// or a network error (ECONNREFUSED at build time) — resolves to null instead of
// throwing, which would otherwise abort static generation and fail the build.
async function fetchJson<T = any>(path: string): Promise<T | null> {
  try {
    const res = await httpClient.get(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`Data fetch failed for ${path}:`, error);
    return null;
  }
}

export const getHomePage = cache(() => fetchJson("/api/pages/home"));

export const getPage = cache((slug: string) => fetchJson(`/api/pages/${slug}`));

export const getPost = cache((slug: string) => fetchJson(`/api/posts/${slug}`));

export const getProject = cache((slug: string) => fetchJson(`/api/projects/${slug}`));

export const getPackage = cache((slug: string) => fetchJson(`/api/packages/${slug}`));

export const getPackageItem = cache((groupSlug: string, packageSlug: string) =>
  fetchJson(`/api/packages/${groupSlug}/${packageSlug}`)
);

export const getPackageDoc = cache((slug: string, docSlug: string) =>
  fetchJson(`/api/packages/${slug}/docs/${docSlug}`)
);

export const getAuthor = cache((username: string) => fetchJson(`/api/authors/${username}`));

export const getPublicPosts = cache((page: number, q?: string) => {
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (q) params.set("q", q);
  return fetchJson(`/api/posts?${params.toString()}`);
});

export const getPublicProjects = cache((page: number) =>
  fetchJson(`/api/projects?page=${page}&limit=10`)
);

export const getPublicPackages = cache((page: number) =>
  fetchJson(`/api/packages?page=${page}&limit=10`)
);
