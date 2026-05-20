import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PostForm from "../../../components/PostForm";

const API_URL = process.env.API_URL || "http://localhost:3001";

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
    redirect("/admin/login");
  }

  // Fetch all posts to find by id
  let posts: PostItem[] = [];
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch posts for edit:", error);
  }

  const post = posts.find((p) => p.id === params.id);

  if (!post) {
    notFound();
  }

  return <PostForm initialData={post} />;
}
