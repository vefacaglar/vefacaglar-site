import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PageForm from "../../../components/PageForm";
import { httpClient } from "../../../../../lib/httpClient";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: "draft" | "published";
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  // Fetch all pages to find by id
  let pages: PageItem[] = [];
  try {
    const res = await httpClient.get("/api/pages", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      pages = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch pages for edit:", error);
  }

  const page = pages.find((p) => p.id === params.id);

  if (!page) {
    notFound();
  }

  return <PageForm initialData={page} />;
}
