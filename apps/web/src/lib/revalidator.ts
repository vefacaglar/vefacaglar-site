"use server";

import { revalidatePath } from "next/cache";

export async function revalidateBlogPages(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/tr/blog");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`/tr/blog/${slug}`);
  }
}

export async function revalidateProjectPages(slug?: string) {
  revalidatePath("/projects");
  revalidatePath("/tr/projects");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/projects/${slug}`);
    revalidatePath(`/tr/projects/${slug}`);
  }
}

export async function revalidatePagePages(slug?: string) {
  revalidatePath("/");
  revalidatePath("/tr");
  revalidatePath("/about");
  revalidatePath("/tr/about");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/tr/${slug}`);
  }
}

export async function revalidatePackagePages(groupSlug?: string) {
  revalidatePath("/packages");
  revalidatePath("/tr/packages");
  revalidatePath("/sitemap.xml");
  if (groupSlug) {
    revalidatePath(`/packages/${groupSlug}`);
    revalidatePath(`/packages/${groupSlug}`, "layout");
    revalidatePath(`/packages/${groupSlug}/docs`);
    revalidatePath(`/tr/packages/${groupSlug}`);
    revalidatePath(`/tr/packages/${groupSlug}`, "layout");
    revalidatePath(`/tr/packages/${groupSlug}/docs`);
  }
}
