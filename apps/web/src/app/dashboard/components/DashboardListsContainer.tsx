"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import DeleteButton from "./DeleteButton";
import SimplePagination from "./SimplePagination";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

interface PageItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

interface DashboardListsContainerProps {
  posts: PostItem[];
  postsTotal: number;
  postsPage: number;
  postsLimit: number;
  postsTotalPages: number;

  projects: ProjectItem[];
  projectsTotal: number;
  projectsPage: number;
  projectsLimit: number;
  projectsTotalPages: number;

  pages: PageItem[];
  pagesTotal: number;
  pagesPage: number;
  pagesLimit: number;
  pagesTotalPages: number;

  deletePostAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  deleteProjectAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  deletePageAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
}

const statusLabel = (status: "draft" | "published") =>
  status === "published" ? ds.content.status.published : ds.content.status.draft;

const renderTableHeaders = () => (
  <tr>
    <th className={styles.th}>{ds.content.table.title}</th>
    <th className={styles.th}>{ds.content.table.status}</th>
    <th className={styles.thRight}>{ds.content.table.actions}</th>
  </tr>
);

export default function DashboardListsContainer({
  posts,
  postsTotal,
  postsPage,
  postsLimit,
  postsTotalPages,
  projects,
  projectsTotal,
  projectsPage,
  projectsLimit,
  projectsTotalPages,
  pages,
  pagesTotal,
  pagesPage,
  pagesLimit,
  pagesTotalPages,
  deletePostAction,
  deleteProjectAction,
  deletePageAction,
}: DashboardListsContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateQueryParam = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      {/* Posts Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{ds.content.posts}</h2>
          <Link href="/dashboard/posts/new" className="btnAccent">
            {ds.content.newPost}
          </Link>
        </div>

        {postsTotal === 0 ? (
          <p className={styles.empty}>{ds.content.noPosts}</p>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>{renderTableHeaders()}</thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id} className={styles.tr}>
                      <td className={styles.td}>
                        <Link href={`/blog/${post.slug}`} target="_blank" className={styles.postLink}>
                          {post.title}
                        </Link>
                      </td>
                      <td className={styles.td}>
                        <span className={post.status === "published" ? styles.statusPublished : styles.statusDraft}>
                          {statusLabel(post.status)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <div className={styles.rowActions}>
                          <Link href={`/dashboard/posts/edit/${post.id}`} className={styles.editLink}>
                            {ds.content.edit}
                          </Link>
                          <DeleteButton id={post.id} type="post" title={post.title} onDelete={deletePostAction} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

             <SimplePagination
               currentPage={postsPage}
               totalPages={postsTotalPages}
               limit={postsLimit}
               onPageChange={(page) => updateQueryParam({ postsPage: page })}
               onLimitChange={(limit) => updateQueryParam({ postsLimit: limit, postsPage: 1 })}
               selectId="postsPageSize"
             />
          </>
        )}
      </section>

      {/* Projects Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{ds.content.projects}</h2>
          <Link href="/dashboard/projects/new" className="btnAccent">
            {ds.content.newProject}
          </Link>
        </div>

        {projectsTotal === 0 ? (
          <p className={styles.empty}>{ds.content.noProjects}</p>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>{renderTableHeaders()}</thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className={styles.tr}>
                      <td className={styles.td}>{project.title} (/projects/{project.slug})</td>
                      <td className={styles.td}>
                        <span className={project.status === "published" ? styles.statusPublished : styles.statusDraft}>
                          {statusLabel(project.status)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <div className={styles.rowActions}>
                          <Link href={`/dashboard/projects/edit/${project.id}`} className={styles.editLink}>
                            {ds.content.edit}
                          </Link>
                          <DeleteButton id={project.id} type="project" title={project.title} onDelete={deleteProjectAction} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

             <SimplePagination
               currentPage={projectsPage}
               totalPages={projectsTotalPages}
               limit={projectsLimit}
               onPageChange={(page) => updateQueryParam({ projectsPage: page })}
               onLimitChange={(limit) => updateQueryParam({ projectsLimit: limit, projectsPage: 1 })}
               selectId="projectsPageSize"
             />
          </>
        )}
      </section>

      {/* Pages Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{ds.content.pages}</h2>
          <Link href="/dashboard/pages/new" className="btnAccent">
            {ds.content.newPage}
          </Link>
        </div>

        {pagesTotal === 0 ? (
          <p className={styles.empty}>{ds.content.noPages}</p>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>{renderTableHeaders()}</thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id} className={styles.tr}>
                      <td className={styles.td}>{page.title} (/{page.slug})</td>
                      <td className={styles.td}>
                        <span className={page.status === "published" ? styles.statusPublished : styles.statusDraft}>
                          {statusLabel(page.status)}
                        </span>
                      </td>
                      <td className={styles.tdRight}>
                        <div className={styles.rowActions}>
                          <Link href={`/dashboard/pages/edit/${page.id}`} className={styles.editLink}>
                            {ds.content.edit}
                          </Link>
                          <DeleteButton id={page.id} type="page" title={page.title} onDelete={deletePageAction} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

             <SimplePagination
               currentPage={pagesPage}
               totalPages={pagesTotalPages}
               limit={pagesLimit}
               onPageChange={(page) => updateQueryParam({ pagesPage: page })}
               onLimitChange={(limit) => updateQueryParam({ pagesLimit: limit, pagesPage: 1 })}
               selectId="pagesPageSize"
             />
          </>
        )}
      </section>
    </div>
  );
}
