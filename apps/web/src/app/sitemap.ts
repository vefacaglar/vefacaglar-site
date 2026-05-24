import { MetadataRoute } from "next";
import { httpClient } from "../lib/httpClient";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vefacaglar.com";

  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tr`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/tr/about`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tr/blog`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tr/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const postsRes = await httpClient.get("/api/posts?limit=1000", {
      cache: "no-store",
    });
    if (postsRes.ok) {
      const postsData = await postsRes.ok ? await postsRes.json() : { items: [] };
      const posts = postsData.items || [];
      for (const post of posts) {
        const lastMod = new Date(post.updatedAt || post.publishedAt || post.createdAt);
        dynamicRoutes.push({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: lastMod,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        });
        dynamicRoutes.push({
          url: `${baseUrl}/tr/blog/${post.slug}`,
          lastModified: lastMod,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        });
      }
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch posts for dynamic sitemap:", error);
  }

  try {
    const pagesRes = await httpClient.get("/api/pages", {
      cache: "no-store",
    });
    if (pagesRes.ok) {
      const pages = await pagesRes.json();
      const pageRoutes = pages
        .filter((page: any) => page.slug !== "about" && page.status === "published")
        .map((page: any) => ({
          url: `${baseUrl}/${page.slug}`,
          lastModified: new Date(page.updatedAt || page.publishedAt || page.createdAt),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }));
      const trPageRoutes = pages
        .filter((page: any) => page.slug !== "about" && page.status === "published")
        .map((page: any) => ({
          url: `${baseUrl}/tr/${page.slug}`,
          lastModified: new Date(page.updatedAt || page.publishedAt || page.createdAt),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }));
      dynamicRoutes = [...dynamicRoutes, ...pageRoutes, ...trPageRoutes];
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch dynamic pages for sitemap:", error);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
