import { cache } from "react";
import { httpClient } from "./httpClient";

export const getHomePage = cache(async () => {
  const res = await httpClient.get("/api/pages/home");
  return res.ok ? res.json() : null;
});

export const getPage = cache(async (slug: string) => {
  const res = await httpClient.get(`/api/pages/${slug}`);
  return res.ok ? res.json() : null;
});

export const getPost = cache(async (slug: string) => {
  const res = await httpClient.get(`/api/posts/${slug}`);
  return res.ok ? res.json() : null;
});

export const getProject = cache(async (slug: string) => {
  const res = await httpClient.get(`/api/projects/${slug}`);
  return res.ok ? res.json() : null;
});

export const getPackage = cache(async (slug: string) => {
  const res = await httpClient.get(`/api/packages/${slug}`);
  return res.ok ? res.json() : null;
});

export const getPackageDoc = cache(async (slug: string, docSlug: string) => {
  const res = await httpClient.get(`/api/packages/${slug}/docs/${docSlug}`);
  return res.ok ? res.json() : null;
});

export const getAuthor = cache(async (username: string) => {
  const res = await httpClient.get(`/api/authors/${username}`);
  return res.ok ? res.json() : null;
});

export const getPublicPosts = cache(async (page: number) => {
  const res = await httpClient.get(`/api/posts?page=${page}&limit=10`);
  return res.ok ? res.json() : null;
});

export const getPublicProjects = cache(async (page: number) => {
  const res = await httpClient.get(`/api/projects?page=${page}&limit=10`);
  return res.ok ? res.json() : null;
});

export const getPublicPackages = cache(async (page: number) => {
  const res = await httpClient.get(`/api/packages?page=${page}&limit=10`);
  return res.ok ? res.json() : null;
});
