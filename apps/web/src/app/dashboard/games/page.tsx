import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import styles from "../dashboard.module.css";
import { httpClient } from "../../../lib/httpClient";
import GamesDashboardClient from "./GamesDashboardClient";

// Interface definitions for the other mock admin catalog records
interface GameCatalogItem {
  id: string;
  title: string;
  slug: string;
  releaseDate?: string;
  metacriticScore?: number;
  openCriticScore?: number;
}

interface PublisherCatalogItem {
  id: string;
  name: string;
  slug: string;
  countryCode?: string;
}

interface GenreCatalogItem {
  id: string;
  name: string;
  slug: string;
}

interface PlatformCatalogItem {
  id: string;
  name: string;
  slug: string;
}

interface ThemeCatalogItem {
  id: string;
  name: string;
  slug: string;
}

export const dynamic = "force-dynamic";

export default async function GamesDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
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

  // Premium mock games matching the database schemas
  const mockGames: GameCatalogItem[] = [
    {
      id: "1",
      title: "The Legend of Zelda: Tears of the Kingdom",
      slug: "the-legend-of-zelda-tears-of-the-kingdom",
      releaseDate: "2023-05-12",
      metacriticScore: 96,
      openCriticScore: 96,
    },
    {
      id: "2",
      title: "Elden Ring",
      slug: "elden-ring",
      releaseDate: "2022-02-25",
      metacriticScore: 96,
      openCriticScore: 95,
    },
    {
      id: "3",
      title: "Cyberpunk 2077",
      slug: "cyberpunk-2077",
      releaseDate: "2020-12-10",
      metacriticScore: 86,
      openCriticScore: 88,
    },
  ];

  // Premium mock publishers matching the database schemas
  const mockPublishers: PublisherCatalogItem[] = [
    { id: "1", name: "Nintendo", slug: "nintendo", countryCode: "JP" },
    { id: "2", name: "Bandai Namco", slug: "bandai-namco", countryCode: "JP" },
    { id: "3", name: "CD Projekt", slug: "cd-projekt", countryCode: "PL" },
  ];

  // Premium mock genres matching the database schemas
  const mockGenres: GenreCatalogItem[] = [
    { id: "1", name: "RPG", slug: "rpg" },
    { id: "2", name: "Action-Adventure", slug: "action-adventure" },
    { id: "3", name: "Strategy", slug: "strategy" },
  ];

  // Premium mock platforms matching the database schemas
  const mockPlatforms: PlatformCatalogItem[] = [
    { id: "1", name: "Nintendo Switch", slug: "nintendo-switch" },
    { id: "2", name: "PC", slug: "pc" },
    { id: "3", name: "PlayStation 5", slug: "playstation-5" },
  ];

  // Premium mock themes matching the database schemas
  const mockThemes: ThemeCatalogItem[] = [
    { id: "1", name: "Fantasy", slug: "fantasy" },
    { id: "2", name: "Sci-Fi", slug: "sci-fi" },
    { id: "3", name: "Post-Apocalyptic", slug: "post-apocalyptic" },
  ];

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

      {/* 1. Global Game Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Games ({mockGames.length})</h2>
          <button className="btnAccent">
            + New Game
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Title</th>
              <th className={styles.th}>Slug</th>
              <th className={styles.th}>Release Date</th>
              <th className={styles.thRight}>Scores (MC / OC)</th>
              <th className={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockGames.map((game) => (
              <tr key={game.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                  {game.title}
                </td>
                <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                  {game.slug}
                </td>
                <td className={styles.td}>
                  {game.releaseDate || "—"}
                </td>
                <td className={styles.tdRight} style={{ fontWeight: 600 }}>
                  {game.metacriticScore || "—"} / {game.openCriticScore || "—"}
                </td>
                <td className={styles.tdRight}>
                  <div className={styles.rowActions}>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      Edit
                    </button>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 2 & 3. Developers and Publishers Catalogs (Using real API and Client Component) */}
      <GamesDashboardClient initialDevelopers={developersData} initialPublishers={publishersData} />

      {/* 4. Genres Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Genres ({mockGenres.length})</h2>
          <button className="btnAccent">
            + New Genre
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Slug</th>
              <th className={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockGenres.map((genre) => (
              <tr key={genre.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                  {genre.name}
                </td>
                <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                  {genre.slug}
                </td>
                <td className={styles.tdRight}>
                  <div className={styles.rowActions}>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      Edit
                    </button>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 5. Platforms Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Platforms ({mockPlatforms.length})</h2>
          <button className="btnAccent">
            + New Platform
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Slug</th>
              <th className={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockPlatforms.map((platform) => (
              <tr key={platform.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                  {platform.name}
                </td>
                <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                  {platform.slug}
                </td>
                <td className={styles.tdRight}>
                  <div className={styles.rowActions}>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      Edit
                    </button>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 6. Themes Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Themes ({mockThemes.length})</h2>
          <button className="btnAccent">
            + New Theme
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Slug</th>
              <th className={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockThemes.map((theme) => (
              <tr key={theme.id} className={styles.tr}>
                <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                  {theme.name}
                </td>
                <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                  {theme.slug}
                </td>
                <td className={styles.tdRight}>
                  <div className={styles.rowActions}>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      Edit
                    </button>
                    <button className={styles.editLink} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
