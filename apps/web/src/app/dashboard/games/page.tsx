import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import styles from "../dashboard.module.css";
import GamesDashboardClient from "./GamesDashboardClient";

export const dynamic = "force-dynamic";

export default async function GamesDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
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

      <GamesDashboardClient />
    </div>
  );
}
