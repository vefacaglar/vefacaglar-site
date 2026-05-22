import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import ProjectForm from "../../../components/ProjectForm";
import { httpClient } from "../../../../../lib/httpClient";

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  status: "draft" | "published";
  featured: boolean;
  sortOrder: number;
  githubUrl?: string | null;
  liveUrl?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function EditProject({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  // Fetch all projects (including drafts for admin)
  let projects: ProjectItem[] = [];
  try {
    const res = await httpClient.get("/api/projects", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      projects = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch projects for edit:", error);
  }

  const project = projects.find((p) => p.id === params.id);

  if (!project) {
    notFound();
  }

  return <ProjectForm initialData={project} />;
}
