import Link from 'next/link';
import styles from "./projects.module.css";
import { getActiveLanguage } from '../../lib/lang';
import { getDictionary } from '../../dictionaries';
import { httpClient } from '../../lib/httpClient';

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  featured: boolean;
  githubUrl?: string | null;
  liveUrl?: string | null;
  createdAt: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const lang = getActiveLanguage();
  const title = lang === "tr" ? "Projeler — Vefa Çağlar" : "Projects — Vefa Çağlar";
  const description = lang === "tr" 
    ? "Geliştirdiğim açık kaynaklı projeler, araçlar ve deneyler." 
    : "Open source projects, tools, and side experiments.";
  return { title, description };
}

export default async function Projects() {
  let projects: ProjectItem[] = [];
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get("/api/projects", {
      cache: "no-store",
    });
    if (res.ok) {
      projects = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch public projects:", error);
  }

  return (
    <div>
      <h1>{dict.projects}</h1>
      <p className={styles.subtitle}>
        {lang === "tr" 
          ? "Geliştirdiğim açık kaynaklı projeler, araçlar ve deneyler." 
          : "Side projects, open source tools, and experiments."}
      </p>

      {projects.length === 0 ? (
        <p className={styles.empty}>{dict.no_projects}</p>
      ) : (
        <ul className={styles.list}>
          {projects.map((project) => (
            <li key={project.id} className={styles.listItem}>
              <span className={styles.dash}>—</span>
              <div className={styles.itemMeta}>
                <div>
                  <Link href={`/projects/${project.slug}`}>{project.title}</Link>
                  {project.featured && (
                    <span className={styles.featuredBadge}>
                      {dict.featured_project || "Featured"}
                    </span>
                  )}
                </div>
                <p className={styles.summary}>{project.summary}</p>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
