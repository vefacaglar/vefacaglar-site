import Link from 'next/link';
import styles from "./projects.module.css";
import { getActiveLanguage } from '../../lib/lang';
import { getDictionary } from '../../dictionaries';
import { localizeHref } from '../../lib/localizeHref';
import Pagination from '../components/Pagination';
import { localizedAlternates } from '../../lib/seo';
import { getPublicProjects } from '../../lib/data';


export async function generateMetadata() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  return {
    title: dict.projects_meta_title,
    description: dict.projects_meta_description,
    alternates: localizedAlternates("/projects", lang),
  };
}

interface ProjectsProps {
  searchParams: {
    page?: string;
  };
}

export default async function Projects({ searchParams }: ProjectsProps) {
  const page = searchParams.page ? Number(searchParams.page) : 1;
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  const data = await getPublicProjects(page);
  const projects = (data?.items ?? []) as {
    id: string;
    slug: string;
    title: string;
    summary: string;
    featured: boolean;
    githubUrl?: string | null;
    liveUrl?: string | null;
    createdAt: string;
  }[];
  const totalPages = data?.totalPages ?? 0;

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
                <span className={styles.dash}>{dict.separator_dash}</span>
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
