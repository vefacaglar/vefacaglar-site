import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PageForm from "../../../components/PageForm";
import { httpClient } from "../../../../../lib/httpClient";
import { requireAdmin } from "../../../../../lib/session";

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

export default async function EditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }
  await requireAdmin();

  let page: PageItem | null = null;
  try {
    const res = await httpClient.get(`/api/pages/dashboard/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      page = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch page for edit:", error);
  }

  if (!page) {
    notFound();
  }

  return <PageForm initialData={page} />;
}
