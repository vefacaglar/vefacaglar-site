import React from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import styles from "./project.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../../dictionaries";
import { localizedAlternates } from "../../../lib/seo";
import AdminEditLink from "../../../components/AdminEditLink";
import { localizeHref } from "../../../lib/localizeHref";
import { getProject } from "../../../lib/data";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const project = await getProject(params.slug);

  if (!project) return { title: dict.project_not_found_title };

  return {
    title: project.seoTitle || formatMetaTitle(project.title, lang),
    description: project.seoDescription || project.summary,
    alternates: localizedAlternates(`/projects/${params.slug}`, lang),
  };
}

export default async function Project({ params }: { params: { slug: string } }) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const project = await getProject(params.slug);

  if (!project) notFound();

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
    const end = project.endedAt ? formatProjectDate(project.endedAt) : dict.present;
    return `${start} ${dict.separator_dash} ${end}`;
  };

  const duration = getDurationString();

  return (
    <article>
      <header className={styles.header}>
        <h1 className={styles.projectTitle}>
          {project.title}
          {project.featured && (
            <span className={styles.featuredBadge}>
              {dict.featured_project}
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
                {dict.source_code}
              </a>
            )}
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                {dict.live_demo}
              </a>
            )}
          </div>
        )}
      </header>

      {project.coverImageUrl && (
        <div className={styles.cover}>
          <Image
            src={project.coverImageUrl}
            alt={project.title}
            width={1280}
            height={720}
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className={styles.coverImg}
          />
        </div>
      )}

      <div className={styles.body}>
        <MarkdownPreview content={project.content} />
      </div>
      {project.id && (
        <AdminEditLink type="project" id={project.id} from={localizeHref(`/projects/${project.slug}`, lang)} />
      )}
    </article>
  );
}
