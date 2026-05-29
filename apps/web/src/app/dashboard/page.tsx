import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction, deleteProjectAction } from "./actions";
import DashboardListsContainer from "./components/DashboardListsContainer";
import styles from "./dashboard.module.css";
import { httpClient } from "../../lib/httpClient";
import ds from "../../lib/dashboard-strings";

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

interface PageProps {
  searchParams: {
    postsPage?: string;
    postsLimit?: string;
    projectsPage?: string;
    projectsLimit?: string;
    pagesPage?: string;
    pagesLimit?: string;
  };
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  const postsPage = Number(searchParams.postsPage) || 1;
  const postsLimit = Number(searchParams.postsLimit) || 10;
  const projectsPage = Number(searchParams.projectsPage) || 1;
  const projectsLimit = Number(searchParams.projectsLimit) || 10;
  const pagesPage = Number(searchParams.pagesPage) || 1;
  const pagesLimit = Number(searchParams.pagesLimit) || 10;

  // Fetch posts (including drafts)
  let posts: PostItem[] = [];
  let postsTotal = 0;
  let postsTotalPages = 0;
  try {
    const res = await httpClient.get(`/api/posts/dashboard?page=${postsPage}&limit=${postsLimit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      posts = data.items || [];
      postsTotal = data.total || 0;
      postsTotalPages = data.totalPages || 0;
    }
  } catch (error) {
    console.error("Failed to fetch posts in dashboard:", error);
  }

  // Fetch pages (including drafts)
  let pages: PageItem[] = [];
  let pagesTotal = 0;
  let pagesTotalPages = 0;
  try {
    const res = await httpClient.get(`/api/pages/dashboard?page=${pagesPage}&limit=${pagesLimit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      pages = data.items || [];
      pagesTotal = data.total || 0;
      pagesTotalPages = data.totalPages || 0;
    }
  } catch (error) {
    console.error("Failed to fetch pages in dashboard:", error);
  }

  // Fetch projects (including drafts)
  let projects: ProjectItem[] = [];
  let projectsTotal = 0;
  let projectsTotalPages = 0;
  try {
    const res = await httpClient.get(`/api/projects/dashboard?page=${projectsPage}&limit=${projectsLimit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      projects = data.items || [];
      projectsTotal = data.total || 0;
      projectsTotalPages = data.totalPages || 0;
    }
  } catch (error) {
    console.error("Failed to fetch projects in dashboard:", error);
  }

  return (
    <div>
      <div className={styles.header}>
          <h1 className={styles.title}>{ds.nav.dashboard}</h1>
        <div className={styles.actions}>
          <Link href="/dashboard/profile" className="btnGhost">
            {ds.nav.profile}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btnGhost">
              {ds.nav.logOut}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <Link href="/dashboard" className={`${styles.tab} ${styles.activeTab}`}>
          {ds.nav.tabs.content}
        </Link>
        <Link href="/dashboard/packages" className={styles.tab}>
          {ds.nav.tabs.packages}
        </Link>
        <Link href="/dashboard/games" className={styles.tab}>
          {ds.nav.tabs.games}
        </Link>
      </div>

      <DashboardListsContainer
        posts={posts}
        postsTotal={postsTotal}
        postsPage={postsPage}
        postsLimit={postsLimit}
        postsTotalPages={postsTotalPages}
        projects={projects}
        projectsTotal={projectsTotal}
        projectsPage={projectsPage}
        projectsLimit={projectsLimit}
        projectsTotalPages={projectsTotalPages}
        pages={pages}
        pagesTotal={pagesTotal}
        pagesPage={pagesPage}
        pagesLimit={pagesLimit}
        pagesTotalPages={pagesTotalPages}
        deletePostAction={deletePostAction}
        deleteProjectAction={deleteProjectAction}
        deletePageAction={deletePageAction}
      />
    </div>
  );
}
