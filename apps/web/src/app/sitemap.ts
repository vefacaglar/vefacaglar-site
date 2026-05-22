import { MetadataRoute } from "next";
import { httpClient } from "../lib/httpClient";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vefacaglar.com";

  // Static routes of the personal website
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
  ];

  let dynamicRoutes: MetadataRoute.Sitemap = [];

  // Fetch dynamic blog posts
  try {
    const postsRes = await httpClient.get("/api/posts?limit=1000", {
      cache: "no-store",
    });
    if (postsRes.ok) {
      const postsData = await postsRes.ok ? await postsRes.json() : { items: [] };
      const posts = postsData.items || [];
      const postRoutes = posts.map((post: any) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }));
      dynamicRoutes = [...dynamicRoutes, ...postRoutes];
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch posts for dynamic sitemap:", error);
  }

  // Fetch dynamic pages
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
      dynamicRoutes = [...dynamicRoutes, ...pageRoutes];
    }
  } catch (error) {
    console.error("Sitemap: Failed to fetch dynamic pages for sitemap:", error);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
