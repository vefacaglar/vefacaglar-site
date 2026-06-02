"use server";

import { revalidatePath } from "next/cache";

export async function revalidateBlogPages(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/blog/${slug}`);
  }
}

export async function revalidateProjectPages(slug?: string) {
  revalidatePath("/projects");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/projects/${slug}`);
  }
}

export async function revalidatePagePages(slug?: string) {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/${slug}`);
  }
}

export async function revalidatePackagePages(groupSlug?: string) {
  revalidatePath("/packages");
  revalidatePath("/sitemap.xml");
  if (groupSlug) {
    revalidatePath(`/packages/${groupSlug}`);
    revalidatePath(`/packages/${groupSlug}`, "layout");
    revalidatePath(`/packages/${groupSlug}/docs`);
  }
}
