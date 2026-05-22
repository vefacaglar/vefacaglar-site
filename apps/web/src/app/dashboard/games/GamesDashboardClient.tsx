"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import clientStyles from "./games-client.module.css";
import {
  createDeveloperAction,
  updateDeveloperAction,
  deleteDeveloperAction,
  createPublisherAction,
  updatePublisherAction,
  deletePublisherAction,
  createGenreAction,
  updateGenreAction,
  deleteGenreAction,
  createThemeAction,
  updateThemeAction,
  deleteThemeAction,
  createPlatformAction,
  updatePlatformAction,
  deletePlatformAction,
  createGameAction,
  updateGameAction,
  deleteGameAction,
} from "./actions";

// Types matching the backend response
export interface Developer {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Publisher {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Platform {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface GameRelationItem {
  id: string;
  name: string;
  slug: string;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
  metacriticScore: number | null;
  openCriticScore: number | null;
  hltbMainHours: string | null;
  hltbMainExtraHours: string | null;
  hltbCompletionistHours: string | null;
  createdAt: string;
  updatedAt: string | null;

  developers: GameRelationItem[];
  publishers: GameRelationItem[];
  genres: GameRelationItem[];
  platforms: GameRelationItem[];
  themes: GameRelationItem[];
}

interface GamesDashboardClientProps {
  initialGames: {
    items: Game[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialDevelopers: {
    items: Developer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialPublishers: {
    items: Publisher[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialGenres: {
    items: Genre[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialThemes: {
    items: Theme[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialPlatforms: {
    items: Platform[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function GamesDashboardClient({
  initialGames,
  initialDevelopers,
  initialPublishers,
  initialGenres,
  initialThemes,
  initialPlatforms,
}: GamesDashboardClientProps) {
  const router = useRouter();

  // Games state
  const [games, setGames] = useState<Game[]>(initialGames.items);
  const [totalGames, setTotalGames] = useState(initialGames.total);

  // Developers state
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers.items);
  const [totalDevs, setTotalDevs] = useState(initialDevelopers.total);

  // Publishers state
  const [publishers, setPublishers] = useState<Publisher[]>(initialPublishers.items);
  const [totalPublishers, setTotalPublishers] = useState(initialPublishers.total);

  // Genres state
  const [genres, setGenres] = useState<Genre[]>(initialGenres.items);
  const [totalGenres, setTotalGenres] = useState(initialGenres.total);

  // Themes state
  const [themes, setThemes] = useState<Theme[]>(initialThemes.items);
  const [totalThemes, setTotalThemes] = useState(initialThemes.total);

  // Platforms state
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms.items);
  const [totalPlatforms, setTotalPlatforms] = useState(initialPlatforms.total);

  // Sync state when props change (Next.js server-side revalidation)
  useEffect(() => {
    setGames(initialGames.items);
    setTotalGames(initialGames.total);
  }, [initialGames]);

  useEffect(() => {
    setDevelopers(initialDevelopers.items);
    setTotalDevs(initialDevelopers.total);
  }, [initialDevelopers]);

  useEffect(() => {
    setPublishers(initialPublishers.items);
    setTotalPublishers(initialPublishers.total);
  }, [initialPublishers]);

  useEffect(() => {
    setGenres(initialGenres.items);
    setTotalGenres(initialGenres.total);
  }, [initialGenres]);

  useEffect(() => {
    setThemes(initialThemes.items);
    setTotalThemes(initialThemes.total);
  }, [initialThemes]);

  useEffect(() => {
    setPlatforms(initialPlatforms.items);
    setTotalPlatforms(initialPlatforms.total);
  }, [initialPlatforms]);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<"game" | "developer" | "publisher" | "genre" | "theme" | "platform">("game");
  const [editingItem, setEditingItem] = useState<Game | Developer | Publisher | Genre | Theme | Platform | null>(null);

  // Form states (Simple fields)
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("");

  // Game Form specific states
  const [gameTitle, setGameTitle] = useState("");
  const [gameOriginalTitle, setGameOriginalTitle] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [gameCoverImageUrl, setGameCoverImageUrl] = useState("");
  const [gameReleaseDate, setGameReleaseDate] = useState("");
  const [gameMetacriticScore, setGameMetacriticScore] = useState<number | "">("");
  const [gameOpenCriticScore, setGameOpenCriticScore] = useState<number | "">("");
  const [gameHltbMainHours, setGameHltbMainHours] = useState<string | number>("");
  const [gameHltbMainExtraHours, setGameHltbMainExtraHours] = useState<string | number>("");
  const [gameHltbCompletionistHours, setGameHltbCompletionistHours] = useState<string | number>("");

  // Game Form relation states
  const [selectedDeveloperIds, setSelectedDeveloperIds] = useState<string[]>([]);
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<string[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to slugify title/name
  const slugify = (text: string) => {
    const trMap: Record<string, string> = {
      'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i',
      'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
    };
    let slugged = text;
    for (const key in trMap) {
      slugged = slugged.replace(new RegExp(key, 'g'), trMap[key]);
    }
    return slugged
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars except -
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  };

  // Auto-generate slug from name/title only when creating a new record
  useEffect(() => {
    if (!editingItem) {
      if (activeType === "game") {
        setSlug(slugify(gameTitle));
      } else {
        setSlug(slugify(name));
      }
    }
  }, [name, gameTitle, activeType, editingItem]);

  const openAddModal = (type: "game" | "developer" | "publisher" | "genre" | "theme" | "platform") => {
    setActiveType(type);
    setEditingItem(null);
    setName("");
    setSlug("");
    setCountryCode("");

    // Game field reset
    setGameTitle("");
    setGameOriginalTitle("");
    setGameDescription("");
    setGameCoverImageUrl("");
    setGameReleaseDate("");
    setGameMetacriticScore("");
    setGameOpenCriticScore("");
    setGameHltbMainHours("");
    setGameHltbMainExtraHours("");
    setGameHltbCompletionistHours("");
    setSelectedDeveloperIds([]);
    setSelectedPublisherIds([]);
    setSelectedGenreIds([]);
    setSelectedPlatformIds([]);
    setSelectedThemeIds([]);

    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (
    type: "game" | "developer" | "publisher" | "genre" | "theme" | "platform",
    item: Game | Developer | Publisher | Genre | Theme | Platform
  ) => {
    setActiveType(type);
    setEditingItem(item);
    setError(null);

    if (type === "game") {
      const game = item as Game;
      setGameTitle(game.title);
      setSlug(game.slug);
      setGameOriginalTitle(game.originalTitle || "");
      setGameDescription(game.description || "");
      setGameCoverImageUrl(game.coverImageUrl || "");
      setGameReleaseDate(game.releaseDate || "");
      setGameMetacriticScore(game.metacriticScore !== null ? game.metacriticScore : "");
      setGameOpenCriticScore(game.openCriticScore !== null ? game.openCriticScore : "");
      setGameHltbMainHours(game.hltbMainHours || "");
      setGameHltbMainExtraHours(game.hltbMainExtraHours || "");
      setGameHltbCompletionistHours(game.hltbCompletionistHours || "");

      setSelectedDeveloperIds(game.developers.map((d) => d.id));
      setSelectedPublisherIds(game.publishers.map((p) => p.id));
      setSelectedGenreIds(game.genres.map((g) => g.id));
      setSelectedPlatformIds(game.platforms.map((pl) => pl.id));
      setSelectedThemeIds(game.themes.map((t) => t.id));
    } else {
      const nonGameItem = item as Developer | Publisher | Genre | Theme | Platform;
      setName(nonGameItem.name);
      setSlug(nonGameItem.slug);
      setCountryCode((nonGameItem as any).countryCode || "");
    }

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setName("");
    setSlug("");
    setCountryCode("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeType === "game") {
      if (!gameTitle.trim()) {
        setError("Title is required");
        return;
      }
    } else {
      if (!name.trim()) {
        setError("Name is required");
        return;
      }
    }

    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    setLoading(true);
    setError(null);

    let res;
    if (activeType === "game") {
      const payload = {
        title: gameTitle.trim(),
        slug: slug.trim(),
        originalTitle: gameOriginalTitle.trim() ? gameOriginalTitle.trim() : null,
        description: gameDescription.trim() ? gameDescription.trim() : null,
        coverImageUrl: gameCoverImageUrl.trim() ? gameCoverImageUrl.trim() : null,
        releaseDate: gameReleaseDate.trim() ? gameReleaseDate.trim() : null,
        metacriticScore: gameMetacriticScore !== "" ? Number(gameMetacriticScore) : null,
        openCriticScore: gameOpenCriticScore !== "" ? Number(gameOpenCriticScore) : null,
        hltbMainHours: gameHltbMainHours !== "" ? String(gameHltbMainHours) : null,
        hltbMainExtraHours: gameHltbMainExtraHours !== "" ? String(gameHltbMainExtraHours) : null,
        hltbCompletionistHours: gameHltbCompletionistHours !== "" ? String(gameHltbCompletionistHours) : null,
        developerIds: selectedDeveloperIds,
        publisherIds: selectedPublisherIds,
        genreIds: selectedGenreIds,
        platformIds: selectedPlatformIds,
        themeIds: selectedThemeIds,
      };

      if (editingItem) {
        res = await updateGameAction(editingItem.id, payload);
      } else {
        res = await createGameAction(payload);
      }
    } else {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
      };

      if (activeType === "developer") {
        if (editingItem) {
          res = await updateDeveloperAction(editingItem.id, {
            ...payload,
            countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null
          });
        } else {
          res = await createDeveloperAction({
            ...payload,
            countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined
          });
        }
      } else if (activeType === "publisher") {
        if (editingItem) {
          res = await updatePublisherAction(editingItem.id, {
            ...payload,
            countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null
          });
        } else {
          res = await createPublisherAction({
            ...payload,
            countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined
          });
        }
      } else if (activeType === "genre") {
        if (editingItem) {
          res = await updateGenreAction(editingItem.id, payload);
        } else {
          res = await createGenreAction(payload);
        }
      } else if (activeType === "theme") {
        if (editingItem) {
          res = await updateThemeAction(editingItem.id, payload);
        } else {
          res = await createThemeAction(payload);
        }
      } else if (activeType === "platform") {
        if (editingItem) {
          res = await updatePlatformAction(editingItem.id, payload);
        } else {
          res = await createPlatformAction(payload);
        }
      }
    }

    if (res && res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      closeModal();
      setLoading(false);
      router.refresh();
    }
  };

  const handleDelete = async (
    type: "game" | "developer" | "publisher" | "genre" | "theme" | "platform",
    id: string,
    itemName: string
  ) => {
    if (!confirm(`Are you sure you want to delete ${type} "${itemName}"?`)) {
      return;
    }

    let res;
    if (type === "game") {
      res = await deleteGameAction(id);
    } else if (type === "developer") {
      res = await deleteDeveloperAction(id);
    } else if (type === "publisher") {
      res = await deletePublisherAction(id);
    } else if (type === "genre") {
      res = await deleteGenreAction(id);
    } else if (type === "theme") {
      res = await deleteThemeAction(id);
    } else if (type === "platform") {
      res = await deletePlatformAction(id);
    }

    if (res && res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div>
      {/* Games Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Games ({totalGames})</h2>
          <button className="btnAccent" onClick={() => openAddModal("game")}>
            + New Game
          </button>
        </div>

        {games.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No games found. Click "+ New Game" to add your first game record.
          </div>
        ) : (
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
              {games.map((game) => (
                <tr key={game.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                      {game.title}
                    </div>
                    {game.originalTitle && (
                      <div style={{ fontSize: "11px", color: "var(--muted)", fontStyle: "italic", marginTop: "2px" }}>
                        {game.originalTitle}
                      </div>
                    )}
                    <div className={clientStyles.relationPills}>
                      {game.developers.map((d) => (
                        <span key={d.id} className={`${clientStyles.pill} ${clientStyles.pillDev}`}>
                          {d.name}
                        </span>
                      ))}
                      {game.publishers.map((p) => (
                        <span key={p.id} className={`${clientStyles.pill} ${clientStyles.pillPub}`}>
                          {p.name}
                        </span>
                      ))}
                      {game.genres.map((g) => (
                        <span key={g.id} className={`${clientStyles.pill} ${clientStyles.pillGenre}`}>
                          {g.name}
                        </span>
                      ))}
                      {game.platforms.map((pl) => (
                        <span key={pl.id} className={`${clientStyles.pill} ${clientStyles.pillPlatform}`}>
                          {pl.name}
                        </span>
                      ))}
                      {game.themes.map((t) => (
                        <span key={t.id} className={`${clientStyles.pill} ${clientStyles.pillTheme}`}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {game.slug}
                  </td>
                  <td className={styles.td}>
                    {game.releaseDate || "—"}
                  </td>
                  <td className={styles.tdRight}>
                    <span className={clientStyles.scoreBadge}>
                      {game.metacriticScore || "—"} / {game.openCriticScore || "—"}
                    </span>
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("game", game)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("game", game.id, game.title)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Developers Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Developers ({totalDevs})</h2>
          <button className="btnAccent" onClick={() => openAddModal("developer")}>
            + New Developer
          </button>
        </div>

        {developers.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No developers found. Click "+ New Developer" to create your first developer record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.th}>Country</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {developers.map((dev) => (
                <tr key={dev.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {dev.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {dev.slug}
                  </td>
                  <td className={styles.td}>
                    {dev.countryCode || "—"}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("developer", dev)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("developer", dev.id, dev.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Publishers Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Publishers ({totalPublishers})</h2>
          <button className="btnAccent" onClick={() => openAddModal("publisher")}>
            + New Publisher
          </button>
        </div>

        {publishers.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No publishers found. Click "+ New Publisher" to create your first publisher record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.th}>Country</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((pub) => (
                <tr key={pub.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {pub.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {pub.slug}
                  </td>
                  <td className={styles.td}>
                    {pub.countryCode || "—"}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("publisher", pub)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("publisher", pub.id, pub.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Genres Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Genres ({totalGenres})</h2>
          <button className="btnAccent" onClick={() => openAddModal("genre")}>
            + New Genre
          </button>
        </div>

        {genres.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No genres found. Click "+ New Genre" to create your first genre record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {genres.map((genre) => (
                <tr key={genre.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {genre.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {genre.slug}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("genre", genre)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("genre", genre.id, genre.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Themes Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Themes ({totalThemes})</h2>
          <button className="btnAccent" onClick={() => openAddModal("theme")}>
            + New Theme
          </button>
        </div>

        {themes.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No themes found. Click "+ New Theme" to create your first theme record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => (
                <tr key={theme.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {theme.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {theme.slug}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("theme", theme)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("theme", theme.id, theme.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Platforms Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Platforms ({totalPlatforms})</h2>
          <button className="btnAccent" onClick={() => openAddModal("platform")}>
            + New Platform
          </button>
        </div>

        {platforms.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No platforms found. Click "+ New Platform" to create your first platform record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((platform) => (
                <tr key={platform.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {platform.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {platform.slug}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.editLink}
                        onClick={() => openEditModal("platform", platform)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.editLink}
                        onClick={() => handleDelete("platform", platform.id, platform.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modern Overlay Form Modal for Add/Edit */}
      {isModalOpen && (
        <div className={clientStyles.modalOverlay} onClick={closeModal}>
          <div
            className={activeType === "game" ? clientStyles.modalContentLarge : clientStyles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={clientStyles.modalHeader}>
              <h3 className={clientStyles.modalTitle}>
                {editingItem
                  ? `Edit ${
                      activeType === "game"
                        ? "Game"
                        : activeType === "developer"
                          ? "Developer"
                          : activeType === "publisher"
                            ? "Publisher"
                            : activeType === "genre"
                              ? "Genre"
                              : activeType === "theme"
                                ? "Theme"
                                : "Platform"
                    }`
                  : `New ${
                      activeType === "game"
                        ? "Game"
                        : activeType === "developer"
                          ? "Developer"
                          : activeType === "publisher"
                            ? "Publisher"
                            : activeType === "genre"
                              ? "Genre"
                              : activeType === "theme"
                                ? "Theme"
                                : "Platform"
                    }`
                }
              </h3>
              <button className={clientStyles.modalClose} onClick={closeModal}>
                &times;
              </button>
            </div>

            {activeType === "game" ? (
              <form onSubmit={handleSubmit}>
                {error && <div className={clientStyles.errorMsg}>{error}</div>}

                <div className={clientStyles.formGrid}>
                  {/* Left Column: Core Fields */}
                  <div>
                    <div className={clientStyles.formSectionTitle}>Core Info</div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-title">Title</label>
                      <input
                        id="game-title"
                        type="text"
                        className={clientStyles.input}
                        placeholder="e.g. Elden Ring"
                        value={gameTitle}
                        onChange={(e) => setGameTitle(e.target.value)}
                        disabled={loading}
                        required
                        autoFocus
                      />
                    </div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-slug">Slug</label>
                      <input
                        id="game-slug"
                        type="text"
                        className={clientStyles.input}
                        placeholder="e.g. elden-ring"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-original-title">Original Title (Optional)</label>
                      <input
                        id="game-original-title"
                        type="text"
                        className={clientStyles.input}
                        placeholder="e.g. エルデンリング"
                        value={gameOriginalTitle}
                        onChange={(e) => setGameOriginalTitle(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-description">Description (Optional)</label>
                      <textarea
                        id="game-description"
                        className={clientStyles.textarea}
                        placeholder="Enter game details/summary..."
                        value={gameDescription}
                        onChange={(e) => setGameDescription(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-cover-image">Cover Image URL (Optional)</label>
                      <input
                        id="game-cover-image"
                        type="text"
                        className={clientStyles.input}
                        placeholder="https://example.com/cover.jpg"
                        value={gameCoverImageUrl}
                        onChange={(e) => setGameCoverImageUrl(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-release-date">Release Date (Optional)</label>
                      <input
                        id="game-release-date"
                        type="date"
                        className={clientStyles.input}
                        value={gameReleaseDate}
                        onChange={(e) => setGameReleaseDate(e.target.value)}
                        disabled={loading}
                      />
                    </div>

                    <div className={clientStyles.rowFields}>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-metacritic">Metacritic Score (Optional)</label>
                        <input
                          id="game-metacritic"
                          type="number"
                          min={0}
                          max={100}
                          className={clientStyles.input}
                          placeholder="0-100"
                          value={gameMetacriticScore}
                          onChange={(e) => setGameMetacriticScore(e.target.value === "" ? "" : Number(e.target.value))}
                          disabled={loading}
                        />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-opencritic">OpenCritic Score (Optional)</label>
                        <input
                          id="game-opencritic"
                          type="number"
                          min={0}
                          max={100}
                          className={clientStyles.input}
                          placeholder="0-100"
                          value={gameOpenCriticScore}
                          onChange={(e) => setGameOpenCriticScore(e.target.value === "" ? "" : Number(e.target.value))}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className={clientStyles.rowThreeFields}>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-main">HLTB Main (h)</label>
                        <input
                          id="game-hltb-main"
                          type="text"
                          className={clientStyles.input}
                          placeholder="e.g. 30"
                          value={gameHltbMainHours}
                          onChange={(e) => setGameHltbMainHours(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-extra">HLTB Main+Ex (h)</label>
                        <input
                          id="game-hltb-extra"
                          type="text"
                          className={clientStyles.input}
                          placeholder="e.g. 50"
                          value={gameHltbMainExtraHours}
                          onChange={(e) => setGameHltbMainExtraHours(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-comp">HLTB Comp (h)</label>
                        <input
                          id="game-hltb-comp"
                          type="text"
                          className={clientStyles.input}
                          placeholder="e.g. 100"
                          value={gameHltbCompletionistHours}
                          onChange={(e) => setGameHltbCompletionistHours(e.target.value)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Relations */}
                  <div>
                    <div className={clientStyles.formSectionTitle}>Relations</div>

                    {/* Developers */}
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label}>Developers</label>
                      <div className={clientStyles.checkboxGroupList}>
                        {developers.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>No developers available. Add some first.</div>
                        ) : (
                          developers.map(dev => (
                            <label key={dev.id} className={clientStyles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={selectedDeveloperIds.includes(dev.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDeveloperIds([...selectedDeveloperIds, dev.id]);
                                  } else {
                                    setSelectedDeveloperIds(selectedDeveloperIds.filter(id => id !== dev.id));
                                  }
                                }}
                                disabled={loading}
                              />
                              {dev.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Publishers */}
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label}>Publishers</label>
                      <div className={clientStyles.checkboxGroupList}>
                        {publishers.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>No publishers available. Add some first.</div>
                        ) : (
                          publishers.map(pub => (
                            <label key={pub.id} className={clientStyles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={selectedPublisherIds.includes(pub.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPublisherIds([...selectedPublisherIds, pub.id]);
                                  } else {
                                    setSelectedPublisherIds(selectedPublisherIds.filter(id => id !== pub.id));
                                  }
                                }}
                                disabled={loading}
                              />
                              {pub.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Genres */}
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label}>Genres</label>
                      <div className={clientStyles.checkboxGroupList}>
                        {genres.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>No genres available. Add some first.</div>
                        ) : (
                          genres.map(genre => (
                            <label key={genre.id} className={clientStyles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={selectedGenreIds.includes(genre.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGenreIds([...selectedGenreIds, genre.id]);
                                  } else {
                                    setSelectedGenreIds(selectedGenreIds.filter(id => id !== genre.id));
                                  }
                                }}
                                disabled={loading}
                              />
                              {genre.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Platforms */}
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label}>Platforms</label>
                      <div className={clientStyles.checkboxGroupList}>
                        {platforms.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>No platforms available. Add some first.</div>
                        ) : (
                          platforms.map(platform => (
                            <label key={platform.id} className={clientStyles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={selectedPlatformIds.includes(platform.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPlatformIds([...selectedPlatformIds, platform.id]);
                                  } else {
                                    setSelectedPlatformIds(selectedPlatformIds.filter(id => id !== platform.id));
                                  }
                                }}
                                disabled={loading}
                              />
                              {platform.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Themes */}
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label}>Themes</label>
                      <div className={clientStyles.checkboxGroupList}>
                        {themes.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--muted)" }}>No themes available. Add some first.</div>
                        ) : (
                          themes.map(theme => (
                            <label key={theme.id} className={clientStyles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={selectedThemeIds.includes(theme.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedThemeIds([...selectedThemeIds, theme.id]);
                                  } else {
                                    setSelectedThemeIds(selectedThemeIds.filter(id => id !== theme.id));
                                  }
                                }}
                                disabled={loading}
                              />
                              {theme.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={clientStyles.modalActions}>
                  <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btnAccent" disabled={loading}>
                    {loading
                      ? "Saving..."
                      : (editingItem ? "Save Changes" : "Create Game")
                    }
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <div className={clientStyles.errorMsg}>{error}</div>}

                <div className={clientStyles.formGroup}>
                  <label className={clientStyles.label} htmlFor="item-name">Name</label>
                  <input
                    id="item-name"
                    type="text"
                    className={clientStyles.input}
                    placeholder={
                      activeType === "developer"
                        ? "Nintendo EPD, FromSoftware..."
                        : activeType === "publisher"
                          ? "Nintendo, Bandai Namco..."
                          : activeType === "genre"
                            ? "Action, RPG, Platformer..."
                            : activeType === "theme"
                              ? "Fantasy, Sci-Fi, Cyberpunk..."
                              : "Nintendo Switch, PC, PlayStation 5..."
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    required
                    autoFocus
                  />
                </div>

                <div className={clientStyles.formGroup}>
                  <label className={clientStyles.label} htmlFor="item-slug">Slug</label>
                  <input
                    id="item-slug"
                    type="text"
                    className={clientStyles.input}
                    placeholder={
                      activeType === "developer"
                        ? "nintendo-epd"
                        : activeType === "publisher"
                          ? "nintendo"
                          : activeType === "genre"
                            ? "action"
                            : activeType === "theme"
                              ? "fantasy"
                              : "nintendo-switch"
                    }
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                {activeType !== "genre" && activeType !== "theme" && activeType !== "platform" && (
                  <div className={clientStyles.formGroup}>
                    <label className={clientStyles.label} htmlFor="item-country">Country Code (2 letters, optional)</label>
                    <input
                      id="item-country"
                      type="text"
                      maxLength={2}
                      className={clientStyles.input}
                      placeholder="JP, US, TR, PL..."
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}

                <div className={clientStyles.modalActions}>
                  <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btnAccent" disabled={loading}>
                    {loading
                      ? "Saving..."
                      : (editingItem
                          ? "Save Changes"
                          : `Create ${
                              activeType === "developer"
                                ? "Developer"
                                : activeType === "publisher"
                                  ? "Publisher"
                                  : activeType === "genre"
                                    ? "Genre"
                                    : activeType === "theme"
                                      ? "Theme"
                                      : "Platform"
                            }`
                        )
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
