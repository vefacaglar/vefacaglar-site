import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import { listPackagesAction } from "./actions";
import PackagesDashboardClient from "./PackagesDashboardClient";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?: string;
    limit?: string;
    q?: string;
  };
}

export default async function PackagesDashboard({ searchParams }: PageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  const page = Number(searchParams.page) || 1;
  const limit = Number(searchParams.limit) || 10;
  const q = searchParams.q || "";

  let packages: any[] = [];
  let total = 0;
  let totalPages = 0;

  try {
    const res = await listPackagesAction({ page, limit, q });
    if (res && !("error" in res)) {
      packages = res.items || [];
      total = res.total || 0;
      totalPages = res.totalPages || 0;
    }
  } catch (error) {
    console.error("Failed to fetch packages in dashboard:", error);
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
        <Link href="/dashboard" className={styles.tab}>
          {ds.nav.tabs.content}
        </Link>
        <Link href="/dashboard/packages" className={`${styles.tab} ${styles.activeTab}`}>
          {ds.nav.tabs.packages}
        </Link>
        <Link href="/dashboard/games" className={styles.tab}>
          {ds.nav.tabs.games}
        </Link>
      </div>

      <PackagesDashboardClient
        packages={packages}
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        q={q}
      />
    </div>
  );
}
