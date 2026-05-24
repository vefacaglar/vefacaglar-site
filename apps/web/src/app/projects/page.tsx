import Link from 'next/link';
import styles from "./projects.module.css";
import { getActiveLanguage } from '../../lib/lang';
import { getDictionary } from '../../dictionaries';
import { localizeHref } from '../../lib/localizeHref';
import { httpClient } from '../../lib/httpClient';
import Pagination from '../components/Pagination';

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

interface ProjectsProps {
  searchParams: {
    page?: string;
  };
}

export default async function Projects({ searchParams }: ProjectsProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  let projectsData = {
    items: [] as ProjectItem[],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  };
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  try {
    const res = await httpClient.get(`/api/projects?page=${page}&limit=10`, {
      cache: "no-store",
    });
    if (res.ok) {
      projectsData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch public projects:", error);
  }

  const projects = projectsData.items || [];
  const totalPages = projectsData.totalPages || 0;

  return (
    <div>
      <h1>{dict.projects}</h1>
      <p className={styles.subtitle}>{dict.projects_subtitle}</p>

      {projects.length === 0 ? (
        <p className={styles.empty}>{dict.no_projects}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {projects.map((project) => (
              <li key={project.id} className={styles.listItem}>
                <span className={styles.dash}>—</span>
                <div className={styles.itemMeta}>
                  <div>
                    <Link href={localizeHref(`/projects/${project.slug}`, lang)}>{project.title}</Link>
                    {project.featured && (
                      <span className={styles.featuredBadge}>
                        {dict.featured_project}
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
                </div>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
