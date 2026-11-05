import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction, deleteProjectAction } from "./actions";
import DashboardListsContainer from "./components/DashboardListsContainer";
import { loadContentList, parseContentQuery, type ContentList } from "./components/content-list";
import styles from "./dashboard.module.css";
import { httpClient } from "../../lib/httpClient";
import ds from "../../lib/dashboard-strings";
import { requireAdmin } from "../../lib/session";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminDashboard(props: PageProps) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }
  await requireAdmin();

  const state = parseContentQuery(searchParams);
  const headers = { Authorization: `Bearer ${token}` };
  let data: ContentList & { page: number } = { items: [], total: 0, totalPages: 0, page: state.page };
  let error = false;
  try {
    data = await loadContentList(state, async (page, limit) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (state.status) params.set("status", state.status);
      const response = await httpClient.get(`/api/${state.type}/dashboard?${params}`, { headers });
      if (!response.ok) throw new Error("Content list request failed.");
      return await response.json() as ContentList;
    });
  } catch (requestError) {
    unstable_rethrow(requestError);
    error = true;
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
        <Link href="/dashboard/jobs" className={styles.tab}>
          {ds.nav.tabs.jobs}
        </Link>
      </div>

      <DashboardListsContainer
        state={{ ...state, page: data.page }}
        items={data.items}
        total={data.total}
        totalPages={data.totalPages}
        error={error}
        deletePostAction={deletePostAction}
        deleteProjectAction={deleteProjectAction}
        deletePageAction={deletePageAction}
      />
    </div>
  );
}
