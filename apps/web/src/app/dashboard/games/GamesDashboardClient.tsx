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
  linkGameDeveloperAction,
  unlinkGameDeveloperAction,
  linkGamePublisherAction,
  unlinkGamePublisherAction,
  linkGameGenreAction,
  unlinkGameGenreAction,
  linkGamePlatformAction,
  unlinkGamePlatformAction,
  linkGameThemeAction,
  unlinkGameThemeAction,
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

  // Active sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"games" | "developers" | "publishers" | "genres" | "themes" | "platforms">("games");
  // Games layout state
  const [gamesViewMode, setGamesViewMode] = useState<"grid" | "list">("list");

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination page tracker states
  const [gamesPage, setGamesPage] = useState(1);
  const [devsPage, setDevsPage] = useState(1);
  const [pubsPage, setPubsPage] = useState(1);
  const [genresPage, setGenresPage] = useState(1);
  const [themesPage, setThemesPage] = useState(1);
  const [platformsPage, setPlatformsPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

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

  // Reset pagination to page 1 on active tab/search/page size switches
  useEffect(() => {
    setGamesPage(1);
    setDevsPage(1);
    setPubsPage(1);
    setGenresPage(1);
    setThemesPage(1);
    setPlatformsPage(1);
  }, [searchQuery, activeSubTab, pageSize]);

  // Load saved games view mode preference on mount to avoid hydration mismatch
  useEffect(() => {
    const savedMode = localStorage.getItem("gamesViewMode");
    if (savedMode === "grid" || savedMode === "list") {
      setGamesViewMode(savedMode);
    }
  }, []);

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

  // Optimistic toggle helper for editing game relations.
  // In add mode (no editingItem) it just mutates local state and lets the create payload carry the IDs.
  // In edit mode it optimistically updates local state, calls the API, and rolls back on failure.
  const toggleRelation = async (
    relationId: string,
    selectedIds: string[],
    setSelectedIds: (ids: string[]) => void,
    linkAction: (gameId: string, relationId: string) => Promise<{ error?: string; success?: boolean }>,
    unlinkAction: (gameId: string, relationId: string) => Promise<{ error?: string; success?: boolean }>
  ) => {
    const isCurrentlySelected = selectedIds.includes(relationId);
    const nextIds = isCurrentlySelected
      ? selectedIds.filter((id) => id !== relationId)
      : [...selectedIds, relationId];

    setSelectedIds(nextIds);

    if (!editingItem) return;

    const gameId = editingItem.id;
    const res = isCurrentlySelected
      ? await unlinkAction(gameId, relationId)
      : await linkAction(gameId, relationId);

    if (res?.error) {
      setSelectedIds(selectedIds);
      setError(res.error);
    }
  };

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

  // Client-side dynamic query filter for Games
  const filteredGames = games.filter((game) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      game.title.toLowerCase().includes(query) ||
      game.slug.toLowerCase().includes(query) ||
      (game.originalTitle && game.originalTitle.toLowerCase().includes(query)) ||
      game.developers.some((d) => d.name.toLowerCase().includes(query)) ||
      game.publishers.some((p) => p.name.toLowerCase().includes(query)) ||
      game.genres.some((g) => g.name.toLowerCase().includes(query)) ||
      game.platforms.some((pl) => pl.name.toLowerCase().includes(query)) ||
      game.themes.some((t) => t.name.toLowerCase().includes(query))
    );
  });

  // Client-side dynamic query filter for Developers
  const filteredDevs = developers.filter((dev) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      dev.name.toLowerCase().includes(query) ||
      dev.slug.toLowerCase().includes(query) ||
      (dev.countryCode && dev.countryCode.toLowerCase().includes(query))
    );
  });

  // Client-side dynamic query filter for Publishers
  const filteredPubs = publishers.filter((pub) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      pub.name.toLowerCase().includes(query) ||
      pub.slug.toLowerCase().includes(query) ||
      (pub.countryCode && pub.countryCode.toLowerCase().includes(query))
    );
  });

  // Client-side dynamic query filter for Genres
  const filteredGenresList = genres.filter((genre) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return genre.name.toLowerCase().includes(query) || genre.slug.toLowerCase().includes(query);
  });

  // Client-side dynamic query filter for Themes
  const filteredThemesList = themes.filter((theme) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return theme.name.toLowerCase().includes(query) || theme.slug.toLowerCase().includes(query);
  });

  // Client-side dynamic query filter for Platforms
  const filteredPlatformsList = platforms.filter((platform) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return platform.name.toLowerCase().includes(query) || platform.slug.toLowerCase().includes(query);
  });

  // Sliced paginated list calculations
  const paginatedGames = filteredGames.slice((gamesPage - 1) * pageSize, gamesPage * pageSize);
  const paginatedDevs = filteredDevs.slice((devsPage - 1) * pageSize, devsPage * pageSize);
  const paginatedPubs = filteredPubs.slice((pubsPage - 1) * pageSize, pubsPage * pageSize);
  const paginatedGenres = filteredGenresList.slice((genresPage - 1) * pageSize, genresPage * pageSize);
  const paginatedThemes = filteredThemesList.slice((themesPage - 1) * pageSize, themesPage * pageSize);
  const paginatedPlatforms = filteredPlatformsList.slice((platformsPage - 1) * pageSize, platformsPage * pageSize);

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
      const baseFields = {
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
      };

      if (editingItem) {
        // Save Changes only updates base game fields; relations are toggled live via link/unlink endpoints.
        res = await updateGameAction(editingItem.id, baseFields);
      } else {
        // On create, send relation IDs in the same request so the new game gets fully wired up in one round-trip.
        res = await createGameAction({
          ...baseFields,
          developerIds: selectedDeveloperIds,
          publisherIds: selectedPublisherIds,
          genreIds: selectedGenreIds,
          platformIds: selectedPlatformIds,
          themeIds: selectedThemeIds,
        });
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

  // Reusable paginator markup renderer
  const renderPagination = (
    currentPage: number,
    totalItems: number,
    setPage: (p: number) => void
  ) => {
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    const getPageNumbers = () => {
      const pages = [];
      const maxPagesToShow = 5;
      if (totalPages <= maxPagesToShow) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (currentPage > 3) pages.push("...");
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    return (
      <div className={clientStyles.paginationContainer}>
        <div className={clientStyles.paginationInfo}>
          Showing {startItem}-{endItem} of {totalItems} items
        </div>
        <div className={clientStyles.paginationControls}>
          <button
            type="button"
            className={`${clientStyles.paginationBtn} ${currentPage === 1 ? clientStyles.paginationBtnDisabled : ""}`}
            onClick={() => currentPage > 1 && setPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            &larr; Prev
          </button>
          {getPageNumbers().map((p, idx) => (
            <button
              key={idx}
              type="button"
              className={`${clientStyles.paginationBtn} ${p === currentPage ? clientStyles.paginationBtnActive : ""} ${p === "..." ? clientStyles.paginationBtnDisabled : ""}`}
              onClick={() => typeof p === "number" && setPage(p)}
              disabled={p === "..."}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className={`${clientStyles.paginationBtn} ${currentPage === totalPages ? clientStyles.paginationBtnDisabled : ""}`}
            onClick={() => currentPage < totalPages && setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next &rarr;
          </button>
        </div>
        <div className={clientStyles.paginationPageSize}>
          <span>Items per page:</span>
          <select
            className={clientStyles.paginationSelect}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Sub-Tabs horizontal navigation */}
      <div className={clientStyles.subTabsContainer}>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "games" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("games")}
        >
          Games <span className={clientStyles.subTabBadge}>{totalGames}</span>
        </button>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "developers" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("developers")}
        >
          Developers <span className={clientStyles.subTabBadge}>{totalDevs}</span>
        </button>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "publishers" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("publishers")}
        >
          Publishers <span className={clientStyles.subTabBadge}>{totalPublishers}</span>
        </button>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "genres" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("genres")}
        >
          Genres <span className={clientStyles.subTabBadge}>{totalGenres}</span>
        </button>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "themes" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("themes")}
        >
          Themes <span className={clientStyles.subTabBadge}>{totalThemes}</span>
        </button>
        <button
          type="button"
          className={`${clientStyles.subTabButton} ${activeSubTab === "platforms" ? clientStyles.subTabButtonActive : ""}`}
          onClick={() => setActiveSubTab("platforms")}
        >
          Platforms <span className={clientStyles.subTabBadge}>{totalPlatforms}</span>
        </button>
      </div>

      {/* Shared Active Catalog Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {activeSubTab === "games" && "Games Library"}
            {activeSubTab === "developers" && "Game Developers"}
            {activeSubTab === "publishers" && "Game Publishers"}
            {activeSubTab === "genres" && "Game Genres"}
            {activeSubTab === "themes" && "Game Themes"}
            {activeSubTab === "platforms" && "Game Platforms"}
          </h2>
          <button
            className="btnAccent"
            onClick={() =>
              openAddModal(
                activeSubTab === "games"
                  ? "game"
                  : activeSubTab === "developers"
                    ? "developer"
                    : activeSubTab === "publishers"
                      ? "publisher"
                      : activeSubTab === "genres"
                        ? "genre"
                        : activeSubTab === "themes"
                          ? "theme"
                          : "platform"
              )
            }
          >
            + New {
              activeSubTab === "games"
                ? "Game"
                : activeSubTab === "developers"
                  ? "Developer"
                  : activeSubTab === "publishers"
                    ? "Publisher"
                    : activeSubTab === "genres"
                      ? "Genre"
                      : activeSubTab === "themes"
                        ? "Theme"
                        : "Platform"
            }
          </button>
        </div>

        {/* Adaptive search bar & layout toggles */}
        <div className={clientStyles.searchBarContainer}>
          <input
            type="text"
            className={clientStyles.searchInput}
            placeholder={
              activeSubTab === "games"
                ? "Search games by title, developer, publisher, genre, platform, theme..."
                : activeSubTab === "developers"
                  ? "Search developers by name, slug, country..."
                  : activeSubTab === "publishers"
                    ? "Search publishers by name, slug, country..."
                    : `Search ${activeSubTab} by name or slug...`
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Grid / List Mode Toggle for Games Catalog */}
          {activeSubTab === "games" && (
            <div className={clientStyles.viewToggleBtnGroup}>
              <button
                type="button"
                className={`${clientStyles.viewToggleBtn} ${gamesViewMode === "grid" ? clientStyles.viewToggleBtnActive : ""}`}
                onClick={() => {
                  setGamesViewMode("grid");
                  localStorage.setItem("gamesViewMode", "grid");
                }}
                title="Grid View"
              >
                Grid
              </button>
              <button
                type="button"
                className={`${clientStyles.viewToggleBtn} ${gamesViewMode === "list" ? clientStyles.viewToggleBtnActive : ""}`}
                onClick={() => {
                  setGamesViewMode("list");
                  localStorage.setItem("gamesViewMode", "list");
                }}
                title="Compact Row List View"
              >
                List
              </button>
            </div>
          )}
        </div>

        {/* Active Tab Catalog Renderings */}
        {activeSubTab === "games" && (
          <>
            {games.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No games found. Click "+ New Game" to add your first game record.
              </div>
            ) : filteredGames.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No games match your search query: "{searchQuery}"
              </div>
            ) : gamesViewMode === "grid" ? (
              <div className={clientStyles.gamesGrid}>
                {paginatedGames.map((game) => {
                  const initials = game.title
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase();

                  const getScoreColorClass = (score: number | null) => {
                    if (!score) return "";
                    if (score >= 90) return clientStyles.scoreHigh;
                    if (score >= 75) return clientStyles.scoreMid;
                    return "";
                  };

                  return (
                    <div key={game.id} className={clientStyles.gameCard}>
                      <div className={clientStyles.gameCardCover}>
                        {game.coverImageUrl ? (
                          <img
                            src={game.coverImageUrl}
                            alt={game.title}
                            className={clientStyles.gameCardImage}
                            loading="lazy"
                          />
                        ) : (
                          <div className={clientStyles.gameCardPlaceholder}>{initials}</div>
                        )}

                        {(game.metacriticScore || game.openCriticScore) && (
                          <div className={clientStyles.gameCardScores}>
                            {game.metacriticScore && (
                              <span
                                className={`${clientStyles.scorePill} ${getScoreColorClass(game.metacriticScore)}`}
                                title="Metacritic Score"
                              >
                                MC: {game.metacriticScore}
                              </span>
                            )}
                            {game.openCriticScore && (
                              <span
                                className={`${clientStyles.scorePill} ${getScoreColorClass(game.openCriticScore)}`}
                                title="OpenCritic Score"
                              >
                                OC: {game.openCriticScore}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className={clientStyles.gameCardContent}>
                        <h4 className={clientStyles.gameCardTitle} title={game.title}>
                          {game.title}
                        </h4>
                        {game.originalTitle && (
                          <div className={clientStyles.gameCardOriginalTitle}>
                            {game.originalTitle}
                          </div>
                        )}

                        <div className={clientStyles.gameCardMeta}>
                          <span>Release: {game.releaseDate || "—"}</span>
                          {game.hltbMainHours && (
                            <span>HLTB: {game.hltbMainHours}h</span>
                          )}
                        </div>

                        <div className={clientStyles.gameCardRelations}>
                          {game.developers.length > 0 && (
                            <div className={clientStyles.relationPills}>
                              {game.developers.map((d) => (
                                <span
                                  key={d.id}
                                  className={`${clientStyles.pill} ${clientStyles.pillDev}`}
                                  title={`Developer: ${d.name}`}
                                >
                                  {d.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {game.publishers.length > 0 && (
                            <div className={clientStyles.relationPills}>
                              {game.publishers.map((p) => (
                                <span
                                  key={p.id}
                                  className={`${clientStyles.pill} ${clientStyles.pillPub}`}
                                  title={`Publisher: ${p.name}`}
                                >
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                          {(game.genres.length > 0 || game.platforms.length > 0 || game.themes.length > 0) && (
                            <div className={clientStyles.relationPills}>
                              {game.genres.map((g) => (
                                <span
                                  key={g.id}
                                  className={`${clientStyles.pill} ${clientStyles.pillGenre}`}
                                  title={`Genre: ${g.name}`}
                                >
                                  {g.name}
                                </span>
                              ))}
                              {game.platforms.map((pl) => (
                                <span
                                  key={pl.id}
                                  className={`${clientStyles.pill} ${clientStyles.pillPlatform}`}
                                  title={`Platform: ${pl.name}`}
                                >
                                  {pl.name}
                                </span>
                              ))}
                              {game.themes.map((t) => (
                                <span
                                  key={t.id}
                                  className={`${clientStyles.pill} ${clientStyles.pillTheme}`}
                                  title={`Theme: ${t.name}`}
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={clientStyles.gameCardActions}>
                        <button
                          type="button"
                          className={styles.editLink}
                          onClick={() => openEditModal("game", game)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.editLink}
                          onClick={() => handleDelete("game", game.id, game.title)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Compact Row List View
              <div className={clientStyles.gamesCompactList}>
                {paginatedGames.map((game) => {
                  const initials = game.title
                    .split(" ")
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 3)
                    .toUpperCase();

                  const getScoreColorClass = (score: number | null) => {
                    if (!score) return "";
                    if (score >= 90) return clientStyles.scoreHigh;
                    if (score >= 75) return clientStyles.scoreMid;
                    return "";
                  };

                  return (
                    <div key={game.id} className={clientStyles.gameCompactRow}>
                      <div className={clientStyles.gameCompactThumb}>
                        {game.coverImageUrl ? (
                          <img
                            src={game.coverImageUrl}
                            alt={game.title}
                            className={clientStyles.gameCompactImage}
                            loading="lazy"
                          />
                        ) : (
                          <div className={clientStyles.gameCompactPlaceholder}>{initials}</div>
                        )}
                      </div>

                      <div className={clientStyles.gameCompactTitleCol}>
                        <h4 className={clientStyles.gameCompactTitle} title={game.title}>
                          {game.title}
                        </h4>
                        {game.originalTitle && (
                          <div className={clientStyles.gameCompactOriginalTitle}>
                            {game.originalTitle}
                          </div>
                        )}
                      </div>

                      <div className={clientStyles.gameCompactScoresCol}>
                        {game.metacriticScore && (
                          <span
                            className={`${clientStyles.scorePill} ${getScoreColorClass(game.metacriticScore)}`}
                            title="Metacritic"
                          >
                            MC: {game.metacriticScore}
                          </span>
                        )}
                        {game.openCriticScore && (
                          <span
                            className={`${clientStyles.scorePill} ${getScoreColorClass(game.openCriticScore)}`}
                            title="OpenCritic"
                          >
                            OC: {game.openCriticScore}
                          </span>
                        )}
                      </div>

                      <div className={clientStyles.gameCompactMetaCol}>
                        <span>Release: {game.releaseDate || "—"}</span>
                        {game.hltbMainHours && (
                          <span>HLTB: {game.hltbMainHours}h</span>
                        )}
                      </div>

                      <div className={clientStyles.gameCompactRelationsCol}>
                        <div className={clientStyles.relationPills}>
                          {game.developers.map((d) => (
                            <span key={d.id} className={`${clientStyles.pill} ${clientStyles.pillDev}`} title={`Developer: ${d.name}`}>{d.name}</span>
                          ))}
                          {game.publishers.map((p) => (
                            <span key={p.id} className={`${clientStyles.pill} ${clientStyles.pillPub}`} title={`Publisher: ${p.name}`}>{p.name}</span>
                          ))}
                          {game.genres.map((g) => (
                            <span key={g.id} className={`${clientStyles.pill} ${clientStyles.pillGenre}`} title={`Genre: ${g.name}`}>{g.name}</span>
                          ))}
                          {game.platforms.map((pl) => (
                            <span key={pl.id} className={`${clientStyles.pill} ${clientStyles.pillPlatform}`} title={`Platform: ${pl.name}`}>{pl.name}</span>
                          ))}
                        </div>
                      </div>

                      <div className={clientStyles.gameCompactActionsCol}>
                        <button
                          type="button"
                          className={styles.editLink}
                          onClick={() => openEditModal("game", game)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.editLink}
                          onClick={() => handleDelete("game", game.id, game.title)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {renderPagination(gamesPage, filteredGames.length, setGamesPage)}
          </>
        )}

        {activeSubTab === "developers" && (
          <>
            {developers.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No developers found. Click "+ New Developer" to create your first developer record.
              </div>
            ) : filteredDevs.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No developers match search query: "{searchQuery}"
              </div>
            ) : (
              <div className={clientStyles.profileCardsGrid}>
                {paginatedDevs.map((dev) => {
                  const initial = dev.name.charAt(0).toUpperCase();
                  return (
                    <div key={dev.id} className={clientStyles.profileCard}>
                      <div className={clientStyles.profileCardHeader}>
                        <div className={clientStyles.profileCardIcon}>{initial}</div>
                        <div className={clientStyles.profileCardInfo}>
                          <h4 className={clientStyles.profileCardName} title={dev.name}>{dev.name}</h4>
                          <div className={clientStyles.profileCardSlug} title={dev.slug}>{dev.slug}</div>
                        </div>
                      </div>
                      <div className={clientStyles.profileCardFooter}>
                        <span className={clientStyles.profileCardCountry}>
                          {dev.countryCode ? `🏳️ ${dev.countryCode}` : "Global"}
                        </span>
                        <div className={clientStyles.profileCardActions}>
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => openEditModal("developer", dev)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => handleDelete("developer", dev.id, dev.name)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {renderPagination(devsPage, filteredDevs.length, setDevsPage)}
          </>
        )}

        {activeSubTab === "publishers" && (
          <>
            {publishers.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No publishers found. Click "+ New Publisher" to create your first publisher record.
              </div>
            ) : filteredPubs.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No publishers match search query: "{searchQuery}"
              </div>
            ) : (
              <div className={clientStyles.profileCardsGrid}>
                {paginatedPubs.map((pub) => {
                  const initial = pub.name.charAt(0).toUpperCase();
                  return (
                    <div key={pub.id} className={clientStyles.profileCard}>
                      <div className={clientStyles.profileCardHeader}>
                        <div className={clientStyles.profileCardIcon}>{initial}</div>
                        <div className={clientStyles.profileCardInfo}>
                          <h4 className={clientStyles.profileCardName} title={pub.name}>{pub.name}</h4>
                          <div className={clientStyles.profileCardSlug} title={pub.slug}>{pub.slug}</div>
                        </div>
                      </div>
                      <div className={clientStyles.profileCardFooter}>
                        <span className={clientStyles.profileCardCountry}>
                          {pub.countryCode ? `🏳️ ${pub.countryCode}` : "Global"}
                        </span>
                        <div className={clientStyles.profileCardActions}>
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => openEditModal("publisher", pub)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.editLink}
                            onClick={() => handleDelete("publisher", pub.id, pub.name)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {renderPagination(pubsPage, filteredPubs.length, setPubsPage)}
          </>
        )}

        {activeSubTab === "genres" && (
          <>
            {genres.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No genres found. Click "+ New Genre" to create your first genre record.
              </div>
            ) : filteredGenresList.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No genres match search query: "{searchQuery}"
              </div>
            ) : (
              <div className={clientStyles.interactiveChipsGrid}>
                {paginatedGenres.map((genre) => (
                  <div key={genre.id} className={clientStyles.interactiveChip}>
                    <span className={clientStyles.interactiveChipName}>{genre.name}</span>
                    <span className={clientStyles.interactiveChipSlug}>{genre.slug}</span>
                    <div className={clientStyles.interactiveChipActions}>
                      <button
                        type="button"
                        className={clientStyles.chipActionBtn}
                        onClick={() => openEditModal("genre", genre)}
                        title="Edit Genre"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${clientStyles.chipActionBtn} ${clientStyles.chipActionDelete}`}
                        onClick={() => handleDelete("genre", genre.id, genre.name)}
                        title="Delete Genre"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {renderPagination(genresPage, filteredGenresList.length, setGenresPage)}
          </>
        )}

        {activeSubTab === "themes" && (
          <>
            {themes.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No themes found. Click "+ New Theme" to create your first theme record.
              </div>
            ) : filteredThemesList.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No themes match search query: "{searchQuery}"
              </div>
            ) : (
              <div className={clientStyles.interactiveChipsGrid}>
                {paginatedThemes.map((theme) => (
                  <div key={theme.id} className={clientStyles.interactiveChip}>
                    <span className={clientStyles.interactiveChipName}>{theme.name}</span>
                    <span className={clientStyles.interactiveChipSlug}>{theme.slug}</span>
                    <div className={clientStyles.interactiveChipActions}>
                      <button
                        type="button"
                        className={clientStyles.chipActionBtn}
                        onClick={() => openEditModal("theme", theme)}
                        title="Edit Theme"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${clientStyles.chipActionBtn} ${clientStyles.chipActionDelete}`}
                        onClick={() => handleDelete("theme", theme.id, theme.name)}
                        title="Delete Theme"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {renderPagination(themesPage, filteredThemesList.length, setThemesPage)}
          </>
        )}

        {activeSubTab === "platforms" && (
          <>
            {platforms.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No platforms found. Click "+ New Platform" to create your first platform record.
              </div>
            ) : filteredPlatformsList.length === 0 ? (
              <div className={clientStyles.emptyState}>
                No platforms match search query: "{searchQuery}"
              </div>
            ) : (
              <div className={clientStyles.interactiveChipsGrid}>
                {paginatedPlatforms.map((platform) => (
                  <div key={platform.id} className={clientStyles.interactiveChip}>
                    <span className={clientStyles.interactiveChipName}>{platform.name}</span>
                    <span className={clientStyles.interactiveChipSlug}>{platform.slug}</span>
                    <div className={clientStyles.interactiveChipActions}>
                      <button
                        type="button"
                        className={clientStyles.chipActionBtn}
                        onClick={() => openEditModal("platform", platform)}
                        title="Edit Platform"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${clientStyles.chipActionBtn} ${clientStyles.chipActionDelete}`}
                        onClick={() => handleDelete("platform", platform.id, platform.name)}
                        title="Delete Platform"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {renderPagination(platformsPage, filteredPlatformsList.length, setPlatformsPage)}
          </>
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
              <button type="button" className={clientStyles.modalClose} onClick={closeModal}>
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
                                onChange={() => toggleRelation(
                                  dev.id,
                                  selectedDeveloperIds,
                                  setSelectedDeveloperIds,
                                  linkGameDeveloperAction,
                                  unlinkGameDeveloperAction,
                                )}
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
                                onChange={() => toggleRelation(
                                  pub.id,
                                  selectedPublisherIds,
                                  setSelectedPublisherIds,
                                  linkGamePublisherAction,
                                  unlinkGamePublisherAction,
                                )}
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
                                onChange={() => toggleRelation(
                                  genre.id,
                                  selectedGenreIds,
                                  setSelectedGenreIds,
                                  linkGameGenreAction,
                                  unlinkGameGenreAction,
                                )}
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
                                onChange={() => toggleRelation(
                                  platform.id,
                                  selectedPlatformIds,
                                  setSelectedPlatformIds,
                                  linkGamePlatformAction,
                                  unlinkGamePlatformAction,
                                )}
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
                                onChange={() => toggleRelation(
                                  theme.id,
                                  selectedThemeIds,
                                  setSelectedThemeIds,
                                  linkGameThemeAction,
                                  unlinkGameThemeAction,
                                )}
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
                    {loading ? "Saving..." : editingItem ? "Save Changes" : "Create Game"}
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
                      : editingItem
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
