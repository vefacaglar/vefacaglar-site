import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction, deleteProjectAction } from "./actions";
import DashboardListsContainer from "./components/DashboardListsContainer";
import styles from "./dashboard.module.css";
import { httpClient } from "../../lib/httpClient";
import ds from "../../lib/dashboard-strings";

export const dynamic = "force-dynamic";

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

interface ListResponse<T> {
  items?: T[];
  total?: number;
  totalPages?: number;
}

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

  const headers = { Authorization: `Bearer ${token}` };

  const [postsRes, pagesRes, projectsRes] = await Promise.all([
    httpClient.get(`/api/posts/dashboard?page=${postsPage}&limit=${postsLimit}`, { headers }).catch(() => null),
    httpClient.get(`/api/pages/dashboard?page=${pagesPage}&limit=${pagesLimit}`, { headers }).catch(() => null),
    httpClient.get(`/api/projects/dashboard?page=${projectsPage}&limit=${projectsLimit}`, { headers }).catch(() => null),
  ]);

  const postsData: ListResponse<PostItem> = postsRes?.ok ? await postsRes.json() : {};
  const pagesData: ListResponse<PageItem> = pagesRes?.ok ? await pagesRes.json() : {};
  const projectsData: ListResponse<ProjectItem> = projectsRes?.ok ? await projectsRes.json() : {};

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
        posts={postsData.items ?? []}
        postsTotal={postsData.total ?? 0}
        postsPage={postsPage}
        postsLimit={postsLimit}
        postsTotalPages={postsData.totalPages ?? 0}
        projects={projectsData.items ?? []}
        projectsTotal={projectsData.total ?? 0}
        projectsPage={projectsPage}
        projectsLimit={projectsLimit}
        projectsTotalPages={projectsData.totalPages ?? 0}
        pages={pagesData.items ?? []}
        pagesTotal={pagesData.total ?? 0}
        pagesPage={pagesPage}
        pagesLimit={pagesLimit}
        pagesTotalPages={pagesData.totalPages ?? 0}
        deletePostAction={deletePostAction}
        deleteProjectAction={deleteProjectAction}
        deletePageAction={deletePageAction}
      />
    </div>
  );
}
