"use client";

import React, { useState } from "react";
import Link from "next/link";
import DeleteButton from "./DeleteButton";
import SimplePagination from "./SimplePagination";
import styles from "../dashboard.module.css";

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
  initialPosts: PostItem[];
  initialProjects: ProjectItem[];
  initialPages: PageItem[];
  deletePostAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  deleteProjectAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
  deletePageAction: (id: string) => Promise<{ success?: boolean; error?: string }>;
}

export default function DashboardListsContainer({
  initialPosts,
  initialProjects,
  initialPages,
  deletePostAction,
  deleteProjectAction,
  deletePageAction,
}: DashboardListsContainerProps) {
  // Posts state
  const [postsPage, setPostsPage] = useState(1);
  const [postsLimit, setPostsLimit] = useState(10);

  // Projects state
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsLimit, setProjectsLimit] = useState(10);

  // Pages state
  const [pagesPage, setPagesPage] = useState(1);
  const [pagesLimit, setPagesLimit] = useState(10);

  // Derive paginated Posts
  const postsTotal = initialPosts.length;
  const postsTotalPages = Math.ceil(postsTotal / postsLimit);
  const activePostsPage = Math.min(postsPage, Math.max(1, postsTotalPages));
  const paginatedPosts = initialPosts.slice(
    (activePostsPage - 1) * postsLimit,
    activePostsPage * postsLimit
  );

  // Derive paginated Projects
  const projectsTotal = initialProjects.length;
  const projectsTotalPages = Math.ceil(projectsTotal / projectsLimit);
  const activeProjectsPage = Math.min(projectsPage, Math.max(1, projectsTotalPages));
  const paginatedProjects = initialProjects.slice(
    (activeProjectsPage - 1) * projectsLimit,
    activeProjectsPage * projectsLimit
  );

  // Derive paginated Pages
  const pagesTotal = initialPages.length;
  const pagesTotalPages = Math.ceil(pagesTotal / pagesLimit);
  const activePagesPage = Math.min(pagesPage, Math.max(1, pagesTotalPages));
  const paginatedPages = initialPages.slice(
    (activePagesPage - 1) * pagesLimit,
    activePagesPage * pagesLimit
  );

  return (
    <div>
      {/* Posts Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Posts (Blog Posts)</h2>
          <Link href="/dashboard/posts/new" className="btnAccent">
            + New Post
          </Link>
        </div>

        {initialPosts.length === 0 ? (
          <p className={styles.empty}>No posts added yet.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Title</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPosts.map((post) => (
                  <tr key={post.id} className={styles.tr}>
                    <td className={styles.td}>
                      <Link href={`/blog/${post.slug}`} target="_blank" className={styles.postLink}>
                        {post.title}
                      </Link>
                    </td>
                    <td className={styles.td}>
                      <span className={post.status === "published" ? styles.statusPublished : styles.statusDraft}>
                        {post.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className={styles.tdRight}>
                      <div className={styles.rowActions}>
                        <Link href={`/dashboard/posts/edit/${post.id}`} className={styles.editLink}>
                          Edit
                        </Link>
                        <DeleteButton id={post.id} type="post" title={post.title} onDelete={deletePostAction} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

             <SimplePagination
               currentPage={postsPage}
               totalPages={postsTotalPages}
               limit={postsLimit}
               onPageChange={setPostsPage}
               onLimitChange={setPostsLimit}
               selectId="postsPageSize"
             />
          </>
        )}
      </section>

      {/* Projects Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Projects</h2>
          <Link href="/dashboard/projects/new" className="btnAccent">
            + New Project
          </Link>
        </div>

        {initialProjects.length === 0 ? (
          <p className={styles.empty}>No projects added yet.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Title</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProjects.map((project) => (
                  <tr key={project.id} className={styles.tr}>
                    <td className={styles.td}>{project.title} (/projects/{project.slug})</td>
                    <td className={styles.td}>
                      <span className={project.status === "published" ? styles.statusPublished : styles.statusDraft}>
                        {project.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className={styles.tdRight}>
                      <div className={styles.rowActions}>
                        <Link href={`/dashboard/projects/edit/${project.id}`} className={styles.editLink}>
                          Edit
                        </Link>
                        <DeleteButton id={project.id} type="project" title={project.title} onDelete={deleteProjectAction} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

             <SimplePagination
               currentPage={projectsPage}
               totalPages={projectsTotalPages}
               limit={projectsLimit}
               onPageChange={setProjectsPage}
               onLimitChange={setProjectsLimit}
               selectId="projectsPageSize"
             />
          </>
        )}
      </section>

      {/* Pages Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pages</h2>
          <Link href="/dashboard/pages/new" className="btnAccent">
            + New Page
          </Link>
        </div>

        {initialPages.length === 0 ? (
          <p className={styles.empty}>No pages added yet.</p>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Title</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPages.map((page) => (
                  <tr key={page.id} className={styles.tr}>
                    <td className={styles.td}>{page.title} (/{page.slug})</td>
                    <td className={styles.td}>
                      <span className={page.status === "published" ? styles.statusPublished : styles.statusDraft}>
                        {page.status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className={styles.tdRight}>
                      <div className={styles.rowActions}>
                        <Link href={`/dashboard/pages/edit/${page.id}`} className={styles.editLink}>
                          Edit
                        </Link>
                        <DeleteButton id={page.id} type="page" title={page.title} onDelete={deletePageAction} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

             <SimplePagination
               currentPage={pagesPage}
               totalPages={pagesTotalPages}
               limit={pagesLimit}
               onPageChange={setPagesPage}
               onLimitChange={setPagesLimit}
               selectId="pagesPageSize"
             />
          </>
        )}
      </section>
    </div>
  );
}
