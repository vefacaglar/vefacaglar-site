import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import styles from "./project.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { httpClient } from "../../../lib/httpClient";

interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  featured: boolean;
  githubUrl?: string | null;
  liveUrl?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

// Dynamic SEO Metadata Generation
export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const res = await httpClient.get(`/api/projects/${params.slug}`);
    if (!res.ok) return { title: "Project Not Found" };

    const project: ProjectDetail = await res.json();
    return {
      title: project.seoTitle || `${project.title} | Vefa Çağlar`,
      description: project.seoDescription || project.summary,
    };
  } catch {
    return { title: "Vefa Çağlar Projects" };
  }
}

export default async function Project({ params }: { params: { slug: string } }) {
  let project: ProjectDetail | null = null;
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/projects/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      project = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch project by slug:", error);
  }

  if (!project) {
    notFound();
  }

  const formatProjectDate = (dateString?: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const getDurationString = () => {
    if (!project?.startedAt) return "";
    const start = formatProjectDate(project.startedAt);
    const end = project.endedAt ? formatProjectDate(project.endedAt) : (lang === "tr" ? "Devam Ediyor" : "Present");
    return `${start} — ${end}`;
  };

  const duration = getDurationString();

  return (
    <article>
      <header className={styles.header}>
        <h1 className={styles.projectTitle}>
          {project.title}
          {project.featured && (
            <span className={styles.featuredBadge}>
              {dict.featured_project || "Featured"}
            </span>
          )}
        </h1>
        {duration && <div className={styles.dates}>{duration}</div>}
        
        {(project.githubUrl || project.liveUrl) && (
          <div className={styles.links}>
            {project.githubUrl && (
              <a 
                href={project.githubUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.link}
              >
                GitHub
              </a>
            )}
            {project.liveUrl && (
              <a 
                href={project.liveUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.link}
              >
                Live Demo
              </a>
            )}
          </div>
        )}
      </header>

      {project.coverImageUrl && (
        <div className={styles.cover}>
          <img
            src={project.coverImageUrl}
            alt={project.title}
            className={styles.coverImg}
          />
        </div>
      )}

      {/* Render Markdown Content */}
      <div className={styles.body}>
        <MarkdownPreview content={project.content} />
      </div>
    </article>
  );
}
