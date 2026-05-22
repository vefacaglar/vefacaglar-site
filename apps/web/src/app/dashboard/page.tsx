import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction, deleteProjectAction } from "./actions";
import DeleteButton from "./components/DeleteButton";
import styles from "./dashboard.module.css";
import { httpClient } from "../../lib/httpClient";

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

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  // Fetch posts (including drafts)
  let posts: PostItem[] = [];
  try {
    const res = await httpClient.get("/api/posts/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch posts in dashboard:", error);
  }

  // Fetch pages (including drafts)
  let pages: PageItem[] = [];
  try {
    const res = await httpClient.get("/api/pages/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      pages = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch pages in dashboard:", error);
  }

  // Fetch projects (including drafts)
  let projects: ProjectItem[] = [];
  try {
    const res = await httpClient.get("/api/projects/dashboard", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      projects = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch projects in dashboard:", error);
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.actions}>
          <Link href="/dashboard/profile" className="btnGhost">
            Profile
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btnGhost">
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Posts Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Posts (Blog Posts)</h2>
          <Link href="/dashboard/posts/new" className="btnAccent">
            + New Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <p className={styles.empty}>No posts added yet.</p>
        ) : (
          <table className={styles.table}>
             <thead>
               <tr>
                 <th className={styles.th}>Title</th>
                 <th className={styles.th}>Status</th>
                 <th className={styles.thRight}>Actions</th>
               </tr>
             </thead>
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
        )}
      </section>

      {/* Projects Section */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Projects</h2>
          <Link href="/dashboard/projects/new" className="btnAccent">
            + New Project
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className={styles.empty}>No projects added yet.</p>
        ) : (
          <table className={styles.table}>
             <thead>
               <tr>
                 <th className={styles.th}>Title</th>
                 <th className={styles.th}>Status</th>
                 <th className={styles.thRight}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {projects.map((project) => (
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
        )}
      </section>

      {/* Pages Section */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Pages</h2>
          <Link href="/dashboard/pages/new" className="btnAccent">
            + New Page
          </Link>
        </div>

        {pages.length === 0 ? (
          <p className={styles.empty}>No pages added yet.</p>
        ) : (
          <table className={styles.table}>
             <thead>
               <tr>
                 <th className={styles.th}>Title</th>
                 <th className={styles.th}>Status</th>
                 <th className={styles.thRight}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {pages.map((page) => (
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
        )}
      </section>
    </div>
  );
}
