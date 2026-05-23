import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import styles from "../dashboard.module.css";
import GamesDashboardClient, { SubTab } from "./GamesDashboardClient";
import {
  listGamesAction,
  listDevelopersAction,
  listPublishersAction,
  listGenresAction,
  listThemesAction,
  listPlatformsAction,
} from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    tab?: string;
    page?: string;
    limit?: string;
    q?: string;
  };
}

export default async function GamesDashboard({ searchParams }: PageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  // Parse parameters
  const tab = (searchParams.tab || "games") as SubTab;
  const page = Number(searchParams.page) || 1;
  const limit = Number(searchParams.limit) || 12;
  const q = searchParams.q || "";

  const params = { page, limit, q };

  let initialItems: any[] = [];
  let initialTotal = 0;

  try {
    const action =
      tab === "games" ? listGamesAction :
      tab === "developers" ? listDevelopersAction :
      tab === "publishers" ? listPublishersAction :
      tab === "genres" ? listGenresAction :
      tab === "themes" ? listThemesAction :
      listPlatformsAction;

    const res = await action(params);

    if (res && !("error" in res)) {
      initialItems = res.items;
      initialTotal = res.total;
    }
  } catch (error) {
    console.error("Failed to load initial server-side games data:", error);
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

      <div className={styles.tabsContainer}>
        <Link href="/dashboard" className={styles.tab}>
          Content
        </Link>
        <Link href="/dashboard/games" className={`${styles.tab} ${styles.activeTab}`}>
          Games
        </Link>
      </div>

      <GamesDashboardClient
        initialItems={initialItems}
        initialTotal={initialTotal}
        initialTab={tab}
        initialPage={page}
        initialLimit={limit}
        initialSearch={q}
      />
    </div>
  );
}

