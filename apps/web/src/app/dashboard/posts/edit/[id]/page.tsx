import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PostForm from "../../../components/PostForm";
import { httpClient } from "../../../../../lib/httpClient";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  status: "draft" | "published";
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function EditPost({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let post: PostItem | null = null;
  try {
    const res = await httpClient.get(`/api/posts/dashboard/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      post = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch post for edit:", error);
  }

  if (!post) {
    notFound();
  }

  return <PostForm initialData={post} />;
}
