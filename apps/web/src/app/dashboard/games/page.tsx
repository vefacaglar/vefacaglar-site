import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import styles from "../dashboard.module.css";
import { httpClient } from "../../../lib/httpClient";
import GamesDashboardClient from "./GamesDashboardClient";

export const dynamic = "force-dynamic";

export default async function GamesDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  // Fetch real games from the backend API
  let gamesData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/games?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      gamesData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch games in dashboard:", error);
  }

  // Fetch real developers from the backend API
  let developersData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/developers?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      developersData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch developers in dashboard:", error);
  }

  // Fetch real publishers from the backend API
  let publishersData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/publishers?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      publishersData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch publishers in dashboard:", error);
  }

  // Fetch real genres from the backend API
  let genresData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/genres?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      genresData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch genres in dashboard:", error);
  }

  // Fetch real themes from the backend API
  let themesData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/themes?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      themesData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch themes in dashboard:", error);
  }

  // Fetch real platforms from the backend API
  let platformsData = { items: [], total: 0, page: 1, limit: 1000, totalPages: 1 };
  try {
    const res = await httpClient.get("/api/games/platforms?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      platformsData = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch platforms in dashboard:", error);
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
        initialGames={gamesData}
        initialDevelopers={developersData}
        initialPublishers={publishersData}
        initialGenres={genresData}
        initialThemes={themesData}
        initialPlatforms={platformsData}
      />
    </div>
  );
}
