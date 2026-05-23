"use client";

import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
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
  listGamesAction,
  listDevelopersAction,
  listPublishersAction,
  listGenresAction,
  listThemesAction,
  listPlatformsAction,
} from "./actions";

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

export type SubTab = "games" | "developers" | "publishers" | "genres" | "themes" | "platforms";
type EntityType = "game" | "developer" | "publisher" | "genre" | "theme" | "platform";

// Tiny debounce hook
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const RELATION_PICKER_LIMIT = 50;

export interface GamesDashboardClientProps {
  initialItems: any[];
  initialTotal: number;
  initialTab: SubTab;
  initialPage: number;
  initialLimit: number;
  initialSearch: string;
}

export default function GamesDashboardClient({
  initialItems,
  initialTotal,
  initialTab,
  initialPage,
  initialLimit,
  initialSearch,
}: GamesDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [gamesViewMode, setGamesViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const debouncedSearch = useDebounced(searchQuery, 300);

  // Derivate values from props
  const activeSubTab = initialTab;
  const page = initialPage;
  const pageSize = initialLimit;
  const items = initialItems;
  const total = initialTotal;

  // Sync searchQuery when URL query changes (e.g. browser back/forward)
  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  // Tab badge counts
  const [counts, setCounts] = useState<Partial<Record<SubTab, number>>>({
    [initialTab]: initialTotal,
  });

  // Sync count when initialTotal or initialTab changes
  useEffect(() => {
    setCounts((c) => ({ ...c, [initialTab]: initialTotal }));
  }, [initialTab, initialTotal]);

  // Handle updates to URL searchParams
  const navigateTo = useCallback((updatedParams: { tab?: SubTab; page?: number; limit?: number; q?: string }) => {
    const params = new URLSearchParams();
    params.set("tab", updatedParams.tab !== undefined ? updatedParams.tab : initialTab);
    params.set("page", String(updatedParams.page !== undefined ? updatedParams.page : initialPage));
    
    const limit = updatedParams.limit !== undefined ? updatedParams.limit : initialLimit;
    if (limit !== 12) {
      params.set("limit", String(limit));
    }
    
    const q = updatedParams.q !== undefined ? updatedParams.q : searchQuery;
    if (q.trim()) {
      params.set("q", q.trim());
    }

    startTransition(() => {
      router.push(`/dashboard/games?${params.toString()}`);
    });
  }, [initialTab, initialPage, initialLimit, searchQuery, router]);

  const getReturnUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", activeSubTab);
    params.set("page", String(page));
    if (pageSize !== 12) {
      params.set("limit", String(pageSize));
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    return `/dashboard/games?${params.toString()}`;
  }, [activeSubTab, page, pageSize, searchQuery]);

  // Trigger search URL update on debounced change
  useEffect(() => {
    if (debouncedSearch !== initialSearch) {
      navigateTo({ page: 1, q: debouncedSearch });
    }
  }, [debouncedSearch, initialSearch, navigateTo]);

  // Tab change
  const handleTabChange = (newTab: SubTab) => {
    navigateTo({ tab: newTab, page: 1 });
  };

  // Page change
  const handlePageChange = (newPage: number) => {
    navigateTo({ page: newPage });
  };

  // Limit change
  const handlePageSizeChange = (newLimit: number) => {
    navigateTo({ page: 1, limit: newLimit });
  };

  // Load saved games view mode
  useEffect(() => {
    const savedMode = localStorage.getItem("gamesViewMode");
    if (savedMode === "grid" || savedMode === "list") {
      setGamesViewMode(savedMode);
    }
  }, []);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<EntityType>("game");
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("");

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

  const [selectedDevelopers, setSelectedDevelopers] = useState<GameRelationItem[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<GameRelationItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<GameRelationItem[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<GameRelationItem[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<GameRelationItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Toggle a relation: optimistic local update, then hit Next.js Route Handler
  // which proxies to Fastify with the session cookie. Rolls back on failure.
  const toggleRelation = async (
    relation: GameRelationItem,
    selected: GameRelationItem[],
    setSelected: (rs: GameRelationItem[]) => void,
    relationType: "developers" | "publishers" | "genres" | "platforms" | "themes"
  ) => {
    const isSelected = selected.some((s) => s.id === relation.id);
    const next = isSelected
      ? selected.filter((s) => s.id !== relation.id)
      : [...selected, relation];

    setSelected(next);

    if (!editingItem) return;

    try {
      const res = await fetch(
        `/api/games/games/${editingItem.id}/${relationType}/${relation.id}`,
        { method: isSelected ? "DELETE" : "POST" }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSelected(selected);
        setError(errData.message || `Failed to ${isSelected ? "unlink" : "link"} ${relationType.slice(0, -1)}.`);
      }
    } catch (err) {
      setSelected(selected);
      setError("Server connection error.");
    }
  };

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
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  useEffect(() => {
    if (!editingItem) {
      if (activeType === "game") {
        setSlug(slugify(gameTitle));
      } else {
        setSlug(slugify(name));
      }
    }
  }, [name, gameTitle, activeType, editingItem]);

  const openAddModal = (type: EntityType) => {
    setActiveType(type);
    setEditingItem(null);
    setName("");
    setSlug("");
    setCountryCode("");
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
    setSelectedDevelopers([]);
    setSelectedPublishers([]);
    setSelectedGenres([]);
    setSelectedPlatforms([]);
    setSelectedThemes([]);
    setError(null);
    setIsModalOpen(true);
  };

  const populateGameForm = (game: Game) => {
    setEditingItem(game);
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
    setSelectedDevelopers(game.developers);
    setSelectedPublishers(game.publishers);
    setSelectedGenres(game.genres);
    setSelectedPlatforms(game.platforms);
    setSelectedThemes(game.themes);
  };

  const openEditModal = async (type: EntityType, item: any) => {
    setActiveType(type);
    setEditingItem(item);
    setError(null);
    setIsModalOpen(true);

    if (type === "game") {
      // Seed with cached row so the modal opens instantly, then refetch the
      // canonical record (with current relations) and overwrite local state.
      populateGameForm(item as Game);
      try {
        const res = await fetch(`/api/games/games/${item.id}`, { cache: "no-store" });
        if (res.ok) {
          const fresh = (await res.json()) as Game;
          populateGameForm(fresh);
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.message || "Failed to load latest game data.");
        }
      } catch {
        setError("Server connection error.");
      }
    } else {
      setName(item.name);
      setSlug(item.slug);
      setCountryCode(item.countryCode || "");
    }
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
      if (!gameTitle.trim()) { setError("Title is required"); return; }
    } else {
      if (!name.trim()) { setError("Name is required"); return; }
    }
    if (!slug.trim()) { setError("Slug is required"); return; }

    setSubmitting(true);
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
        res = await updateGameAction(editingItem.id, baseFields);
      } else {
        res = await createGameAction({
          ...baseFields,
          developerIds: selectedDevelopers.map((d) => d.id),
          publisherIds: selectedPublishers.map((p) => p.id),
          genreIds: selectedGenres.map((g) => g.id),
          platformIds: selectedPlatforms.map((p) => p.id),
          themeIds: selectedThemes.map((t) => t.id),
        });
      }
    } else {
      const payload = { name: name.trim(), slug: slug.trim() };
      if (activeType === "developer") {
        res = editingItem
          ? await updateDeveloperAction(editingItem.id, { ...payload, countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null })
          : await createDeveloperAction({ ...payload, countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined });
      } else if (activeType === "publisher") {
        res = editingItem
          ? await updatePublisherAction(editingItem.id, { ...payload, countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null })
          : await createPublisherAction({ ...payload, countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined });
      } else if (activeType === "genre") {
        res = editingItem ? await updateGenreAction(editingItem.id, payload) : await createGenreAction(payload);
      } else if (activeType === "theme") {
        res = editingItem ? await updateThemeAction(editingItem.id, payload) : await createThemeAction(payload);
      } else if (activeType === "platform") {
        res = editingItem ? await updatePlatformAction(editingItem.id, payload) : await createPlatformAction(payload);
      }
    }

    if (res && res.error) {
      setError(res.error);
      setSubmitting(false);
    } else {
      closeModal();
      setSubmitting(false);
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleDelete = async (type: EntityType, id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete ${type} "${itemName}"?`)) return;

    let res;
    if (type === "game") res = await deleteGameAction(id);
    else if (type === "developer") res = await deleteDeveloperAction(id);
    else if (type === "publisher") res = await deletePublisherAction(id);
    else if (type === "genre") res = await deleteGenreAction(id);
    else if (type === "theme") res = await deleteThemeAction(id);
    else if (type === "platform") res = await deletePlatformAction(id);

    if (res && res.error) {
      alert(res.error);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (totalPages <= 1) return null;

    const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    const getPageNumbers = () => {
      const pages: (number | string)[] = [];
      const maxPagesToShow = 5;
      if (totalPages <= maxPagesToShow) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (page > 3) pages.push("...");
        const start = Math.max(2, page - 1);
        const end = Math.min(totalPages - 1, page + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (page < totalPages - 2) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    return (
      <div className={clientStyles.paginationContainer}>
        <div className={clientStyles.paginationInfo}>
          Showing {startItem}-{endItem} of {total} items
        </div>
        <div className={clientStyles.paginationControls}>
          <button
            type="button"
            className={`${clientStyles.paginationBtn} ${page === 1 ? clientStyles.paginationBtnDisabled : ""}`}
            onClick={() => page > 1 && handlePageChange(page - 1)}
            disabled={page === 1}
          >
            &larr; Prev
          </button>
          {getPageNumbers().map((p, idx) => (
            <button
              key={idx}
              type="button"
              className={`${clientStyles.paginationBtn} ${p === page ? clientStyles.paginationBtnActive : ""} ${p === "..." ? clientStyles.paginationBtnDisabled : ""}`}
              onClick={() => typeof p === "number" && handlePageChange(p)}
              disabled={p === "..."}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className={`${clientStyles.paginationBtn} ${page === totalPages ? clientStyles.paginationBtnDisabled : ""}`}
            onClick={() => page < totalPages && handlePageChange(page + 1)}
            disabled={page === totalPages}
          >
            Next &rarr;
          </button>
        </div>
        <div className={clientStyles.paginationPageSize}>
          <span>Items per page:</span>
          <select
            className={clientStyles.paginationSelect}
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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

  const getScoreColorClass = (score: number | null) => {
    if (!score) return "";
    if (score >= 90) return clientStyles.scoreHigh;
    if (score >= 75) return clientStyles.scoreMid;
    return "";
  };

  return (
    <div>
      <div className={clientStyles.subTabsContainer}>
        {(["games", "developers", "publishers", "genres", "themes", "platforms"] as SubTab[]).map((tab) => {
          const labels: Record<SubTab, string> = {
            games: "Games",
            developers: "Developers",
            publishers: "Publishers",
            genres: "Genres",
            themes: "Themes",
            platforms: "Platforms",
          };
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              className={`${clientStyles.subTabButton} ${activeSubTab === tab ? clientStyles.subTabButtonActive : ""}`}
              onClick={() => handleTabChange(tab)}
            >
              {labels[tab]} {count !== undefined && <span className={clientStyles.subTabBadge}>{count}</span>}
            </button>
          );
        })}
      </div>

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
            onClick={() => openAddModal(
              activeSubTab === "games" ? "game" :
              activeSubTab === "developers" ? "developer" :
              activeSubTab === "publishers" ? "publisher" :
              activeSubTab === "genres" ? "genre" :
              activeSubTab === "themes" ? "theme" : "platform"
            )}
          >
            + New {
              activeSubTab === "games" ? "Game" :
              activeSubTab === "developers" ? "Developer" :
              activeSubTab === "publishers" ? "Publisher" :
              activeSubTab === "genres" ? "Genre" :
              activeSubTab === "themes" ? "Theme" : "Platform"
            }
          </button>
        </div>

        <div className={clientStyles.searchBarContainer}>
          <input
            type="text"
            className={clientStyles.searchInput}
            placeholder={
              activeSubTab === "games"
                ? "Search games by title or slug..."
                : activeSubTab === "developers" || activeSubTab === "publishers"
                  ? `Search ${activeSubTab} by name or slug...`
                  : `Search ${activeSubTab} by name or slug...`
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {activeSubTab === "games" && (
            <div className={clientStyles.viewToggleBtnGroup}>
              <button
                type="button"
                className={`${clientStyles.viewToggleBtn} ${gamesViewMode === "grid" ? clientStyles.viewToggleBtnActive : ""}`}
                onClick={() => { setGamesViewMode("grid"); localStorage.setItem("gamesViewMode", "grid"); }}
                title="Grid View"
              >Grid</button>
              <button
                type="button"
                className={`${clientStyles.viewToggleBtn} ${gamesViewMode === "list" ? clientStyles.viewToggleBtnActive : ""}`}
                onClick={() => { setGamesViewMode("list"); localStorage.setItem("gamesViewMode", "list"); }}
                title="Compact Row List View"
              >List</button>
            </div>
          )}
        </div>

        <div
          style={{
            opacity: isPending ? 0.6 : 1,
            pointerEvents: isPending ? "none" : "auto",
            transition: "opacity 0.2s ease-in-out",
          }}
        >
          {items.length === 0 && (
            <div className={clientStyles.emptyState}>
              {debouncedSearch
                ? `No ${activeSubTab} match your search query: "${debouncedSearch}"`
                : `No ${activeSubTab} found.`}
            </div>
          )}

          {items.length > 0 && activeSubTab === "games" && (
            gamesViewMode === "grid" ? (
              <div className={clientStyles.gamesGrid}>
                {(items as Game[]).map((game) => {
                  const initials = game.title.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
                  return (
                    <div key={game.id} className={clientStyles.gameCard}>
                      <div className={clientStyles.gameCardCover}>
                        {game.coverImageUrl ? (
                          <img src={game.coverImageUrl} alt={game.title} className={clientStyles.gameCardImage} loading="lazy" />
                        ) : (
                          <div className={clientStyles.gameCardPlaceholder}>{initials}</div>
                        )}
                        {(game.metacriticScore || game.openCriticScore) && (
                          <div className={clientStyles.gameCardScores}>
                            {game.metacriticScore && (
                              <span className={`${clientStyles.scorePill} ${getScoreColorClass(game.metacriticScore)}`} title="Metacritic Score">MC: {game.metacriticScore}</span>
                            )}
                            {game.openCriticScore && (
                              <span className={`${clientStyles.scorePill} ${getScoreColorClass(game.openCriticScore)}`} title="OpenCritic Score">OC: {game.openCriticScore}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className={clientStyles.gameCardContent}>
                        <h4 className={clientStyles.gameCardTitle} title={game.title}>{game.title}</h4>
                        {game.originalTitle && <div className={clientStyles.gameCardOriginalTitle}>{game.originalTitle}</div>}
                        <div className={clientStyles.gameCardMeta}>
                          <span>Release: {game.releaseDate || "—"}</span>
                          {game.hltbMainHours && <span>HLTB: {game.hltbMainHours}h</span>}
                        </div>
                        <div className={clientStyles.gameCardRelations}>
                          {game.developers.length > 0 && (
                            <div className={clientStyles.relationPills}>
                              {game.developers.map((d) => (
                                <span key={d.id} className={`${clientStyles.pill} ${clientStyles.pillDev}`} title={`Developer: ${d.name}`}>{d.name}</span>
                              ))}
                            </div>
                          )}
                          {game.publishers.length > 0 && (
                            <div className={clientStyles.relationPills}>
                              {game.publishers.map((p) => (
                                <span key={p.id} className={`${clientStyles.pill} ${clientStyles.pillPub}`} title={`Publisher: ${p.name}`}>{p.name}</span>
                              ))}
                            </div>
                          )}
                          {(game.genres.length > 0 || game.platforms.length > 0 || game.themes.length > 0) && (
                            <div className={clientStyles.relationPills}>
                              {game.genres.map((g) => (
                                <span key={g.id} className={`${clientStyles.pill} ${clientStyles.pillGenre}`} title={`Genre: ${g.name}`}>{g.name}</span>
                              ))}
                              {game.platforms.map((pl) => (
                                <span key={pl.id} className={`${clientStyles.pill} ${clientStyles.pillPlatform}`} title={`Platform: ${pl.name}`}>{pl.name}</span>
                              ))}
                              {game.themes.map((t) => (
                                <span key={t.id} className={`${clientStyles.pill} ${clientStyles.pillTheme}`} title={`Theme: ${t.name}`}>{t.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={clientStyles.gameCardActions}>
                        <Link href={`/dashboard/games/edit/${game.id}?returnUrl=${encodeURIComponent(getReturnUrl())}`} className={styles.editLink}>Edit</Link>
                        <button type="button" className={styles.editLink} onClick={() => handleDelete("game", game.id, game.title)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={clientStyles.gamesCompactList}>
                {(items as Game[]).map((game) => {
                  const initials = game.title.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();
                  return (
                    <div key={game.id} className={clientStyles.gameCompactRow}>
                      <div className={clientStyles.gameCompactThumb}>
                        {game.coverImageUrl ? (
                          <img src={game.coverImageUrl} alt={game.title} className={clientStyles.gameCompactImage} loading="lazy" />
                        ) : (
                          <div className={clientStyles.gameCompactPlaceholder}>{initials}</div>
                        )}
                      </div>
                      <div className={clientStyles.gameCompactTitleCol}>
                        <h4 className={clientStyles.gameCompactTitle} title={game.title}>{game.title}</h4>
                        {game.originalTitle && <div className={clientStyles.gameCompactOriginalTitle}>{game.originalTitle}</div>}
                      </div>
                      <div className={clientStyles.gameCompactScoresCol}>
                        {game.metacriticScore && (<span className={`${clientStyles.scorePill} ${getScoreColorClass(game.metacriticScore)}`} title="Metacritic">MC: {game.metacriticScore}</span>)}
                        {game.openCriticScore && (<span className={`${clientStyles.scorePill} ${getScoreColorClass(game.openCriticScore)}`} title="OpenCritic">OC: {game.openCriticScore}</span>)}
                      </div>
                      <div className={clientStyles.gameCompactMetaCol}>
                        <span>Release: {game.releaseDate || "—"}</span>
                        {game.hltbMainHours && <span>HLTB: {game.hltbMainHours}h</span>}
                      </div>
                      <div className={clientStyles.gameCompactRelationsCol}>
                        <div className={clientStyles.relationPills}>
                          {game.developers.map((d) => (<span key={d.id} className={`${clientStyles.pill} ${clientStyles.pillDev}`} title={`Developer: ${d.name}`}>{d.name}</span>))}
                          {game.publishers.map((p) => (<span key={p.id} className={`${clientStyles.pill} ${clientStyles.pillPub}`} title={`Publisher: ${p.name}`}>{p.name}</span>))}
                          {game.genres.map((g) => (<span key={g.id} className={`${clientStyles.pill} ${clientStyles.pillGenre}`} title={`Genre: ${g.name}`}>{g.name}</span>))}
                          {game.platforms.map((pl) => (<span key={pl.id} className={`${clientStyles.pill} ${clientStyles.pillPlatform}`} title={`Platform: ${pl.name}`}>{pl.name}</span>))}
                        </div>
                      </div>
                      <div className={clientStyles.gameCompactActionsCol}>
                        <Link href={`/dashboard/games/edit/${game.id}?returnUrl=${encodeURIComponent(getReturnUrl())}`} className={styles.editLink}>Edit</Link>
                        <button type="button" className={styles.editLink} onClick={() => handleDelete("game", game.id, game.title)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {items.length > 0 && (activeSubTab === "developers" || activeSubTab === "publishers") && (
            <div className={clientStyles.profileCardsGrid}>
              {(items as (Developer | Publisher)[]).map((it) => {
                const initial = it.name.charAt(0).toUpperCase();
                const t: "developer" | "publisher" = activeSubTab === "developers" ? "developer" : "publisher";
                return (
                  <div key={it.id} className={clientStyles.profileCard}>
                    <div className={clientStyles.profileCardHeader}>
                      <div className={clientStyles.profileCardIcon}>{initial}</div>
                      <div className={clientStyles.profileCardInfo}>
                        <h4 className={clientStyles.profileCardName} title={it.name}>{it.name}</h4>
                        <div className={clientStyles.profileCardSlug} title={it.slug}>{it.slug}</div>
                      </div>
                    </div>
                    <div className={clientStyles.profileCardFooter}>
                      <span className={clientStyles.profileCardCountry}>{it.countryCode ? `🏳️ ${it.countryCode}` : "Global"}</span>
                      <div className={clientStyles.profileCardActions}>
                        <button type="button" className={styles.editLink} onClick={() => openEditModal(t, it)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Edit</button>
                        <button type="button" className={styles.editLink} onClick={() => handleDelete(t, it.id, it.name)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {items.length > 0 && (activeSubTab === "genres" || activeSubTab === "themes" || activeSubTab === "platforms") && (
            <div className={clientStyles.interactiveChipsGrid}>
              {(items as (Genre | Theme | Platform)[]).map((it) => {
                const t: "genre" | "theme" | "platform" =
                  activeSubTab === "genres" ? "genre" :
                  activeSubTab === "themes" ? "theme" : "platform";
                return (
                  <div key={it.id} className={clientStyles.interactiveChip}>
                    <span className={clientStyles.interactiveChipName}>{it.name}</span>
                    <span className={clientStyles.interactiveChipSlug}>{it.slug}</span>
                    <div className={clientStyles.interactiveChipActions}>
                      <button type="button" className={clientStyles.chipActionBtn} onClick={() => openEditModal(t, it)} title={`Edit ${t}`}>Edit</button>
                      <button type="button" className={`${clientStyles.chipActionBtn} ${clientStyles.chipActionDelete}`} onClick={() => handleDelete(t, it.id, it.name)} title={`Delete ${t}`}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {renderPagination()}
        </div>
      </section>

      {isModalOpen && (
        <div className={clientStyles.modalOverlay} onClick={closeModal}>
          <div className={activeType === "game" ? clientStyles.modalContentLarge : clientStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={clientStyles.modalHeader}>
              <h3 className={clientStyles.modalTitle}>
                {editingItem ? `Edit ${activeType.charAt(0).toUpperCase() + activeType.slice(1)}` : `New ${activeType.charAt(0).toUpperCase() + activeType.slice(1)}`}
              </h3>
              <button type="button" className={clientStyles.modalClose} onClick={closeModal}>&times;</button>
            </div>

            {activeType === "game" ? (
              <form onSubmit={handleSubmit}>
                {error && <div className={clientStyles.errorMsg}>{error}</div>}
                <div className={clientStyles.formGrid}>
                  <div>
                    <div className={clientStyles.formSectionTitle}>Core Info</div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-title">Title</label>
                      <input id="game-title" type="text" className={clientStyles.input} placeholder="e.g. Elden Ring" value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} disabled={submitting} required autoFocus />
                    </div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-slug">Slug</label>
                      <input id="game-slug" type="text" className={clientStyles.input} placeholder="e.g. elden-ring" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={submitting} required />
                    </div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-original-title">Original Title (Optional)</label>
                      <input id="game-original-title" type="text" className={clientStyles.input} placeholder="e.g. エルデンリング" value={gameOriginalTitle} onChange={(e) => setGameOriginalTitle(e.target.value)} disabled={submitting} />
                    </div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-description">Description (Optional)</label>
                      <textarea id="game-description" className={clientStyles.textarea} placeholder="Enter game details/summary..." value={gameDescription} onChange={(e) => setGameDescription(e.target.value)} disabled={submitting} />
                    </div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-cover-image">Cover Image URL (Optional)</label>
                      <input id="game-cover-image" type="text" className={clientStyles.input} placeholder="https://example.com/cover.jpg" value={gameCoverImageUrl} onChange={(e) => setGameCoverImageUrl(e.target.value)} disabled={submitting} />
                    </div>
                    <div className={clientStyles.formGroup}>
                      <label className={clientStyles.label} htmlFor="game-release-date">Release Date (Optional)</label>
                      <input id="game-release-date" type="date" className={clientStyles.input} value={gameReleaseDate} onChange={(e) => setGameReleaseDate(e.target.value)} disabled={submitting} />
                    </div>
                    <div className={clientStyles.rowFields}>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-metacritic">Metacritic Score (Optional)</label>
                        <input id="game-metacritic" type="number" min={0} max={100} className={clientStyles.input} placeholder="0-100" value={gameMetacriticScore} onChange={(e) => setGameMetacriticScore(e.target.value === "" ? "" : Number(e.target.value))} disabled={submitting} />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-opencritic">OpenCritic Score (Optional)</label>
                        <input id="game-opencritic" type="number" min={0} max={100} className={clientStyles.input} placeholder="0-100" value={gameOpenCriticScore} onChange={(e) => setGameOpenCriticScore(e.target.value === "" ? "" : Number(e.target.value))} disabled={submitting} />
                      </div>
                    </div>
                    <div className={clientStyles.rowThreeFields}>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-main">HLTB Main (h)</label>
                        <input id="game-hltb-main" type="text" className={clientStyles.input} placeholder="e.g. 30" value={gameHltbMainHours} onChange={(e) => setGameHltbMainHours(e.target.value)} disabled={submitting} />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-extra">HLTB Main+Ex (h)</label>
                        <input id="game-hltb-extra" type="text" className={clientStyles.input} placeholder="e.g. 50" value={gameHltbMainExtraHours} onChange={(e) => setGameHltbMainExtraHours(e.target.value)} disabled={submitting} />
                      </div>
                      <div className={clientStyles.formGroup}>
                        <label className={clientStyles.label} htmlFor="game-hltb-comp">HLTB Comp (h)</label>
                        <input id="game-hltb-comp" type="text" className={clientStyles.input} placeholder="e.g. 100" value={gameHltbCompletionistHours} onChange={(e) => setGameHltbCompletionistHours(e.target.value)} disabled={submitting} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className={clientStyles.formSectionTitle}>Relations</div>

                    <RelationPicker
                      label="Developers"
                      kind="developer"
                      selected={selectedDevelopers}
                      onToggle={(rel) => toggleRelation(rel, selectedDevelopers, setSelectedDevelopers, "developers")}
                      disabled={submitting}
                    />
                    <RelationPicker
                      label="Publishers"
                      kind="publisher"
                      selected={selectedPublishers}
                      onToggle={(rel) => toggleRelation(rel, selectedPublishers, setSelectedPublishers, "publishers")}
                      disabled={submitting}
                    />
                    <RelationPicker
                      label="Genres"
                      kind="genre"
                      selected={selectedGenres}
                      onToggle={(rel) => toggleRelation(rel, selectedGenres, setSelectedGenres, "genres")}
                      disabled={submitting}
                    />
                    <RelationPicker
                      label="Platforms"
                      kind="platform"
                      selected={selectedPlatforms}
                      onToggle={(rel) => toggleRelation(rel, selectedPlatforms, setSelectedPlatforms, "platforms")}
                      disabled={submitting}
                    />
                    <RelationPicker
                      label="Themes"
                      kind="theme"
                      selected={selectedThemes}
                      onToggle={(rel) => toggleRelation(rel, selectedThemes, setSelectedThemes, "themes")}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className={clientStyles.modalActions}>
                  <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btnAccent" disabled={submitting}>{submitting ? "Saving..." : editingItem ? "Save Changes" : "Create Game"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <div className={clientStyles.errorMsg}>{error}</div>}
                <div className={clientStyles.formGroup}>
                  <label className={clientStyles.label} htmlFor="item-name">Name</label>
                  <input id="item-name" type="text" className={clientStyles.input}
                    placeholder={
                      activeType === "developer" ? "Nintendo EPD, FromSoftware..."
                      : activeType === "publisher" ? "Nintendo, Bandai Namco..."
                      : activeType === "genre" ? "Action, RPG, Platformer..."
                      : activeType === "theme" ? "Fantasy, Sci-Fi, Cyberpunk..."
                      : "Nintendo Switch, PC, PlayStation 5..."
                    }
                    value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} required autoFocus />
                </div>
                <div className={clientStyles.formGroup}>
                  <label className={clientStyles.label} htmlFor="item-slug">Slug</label>
                  <input id="item-slug" type="text" className={clientStyles.input}
                    placeholder={
                      activeType === "developer" ? "nintendo-epd"
                      : activeType === "publisher" ? "nintendo"
                      : activeType === "genre" ? "action"
                      : activeType === "theme" ? "fantasy"
                      : "nintendo-switch"
                    }
                    value={slug} onChange={(e) => setSlug(e.target.value)} disabled={submitting} required />
                </div>
                {(activeType === "developer" || activeType === "publisher") && (
                  <div className={clientStyles.formGroup}>
                    <label className={clientStyles.label} htmlFor="item-country">Country Code (2 letters, optional)</label>
                    <input id="item-country" type="text" maxLength={2} className={clientStyles.input} placeholder="JP, US, TR, PL..." value={countryCode} onChange={(e) => setCountryCode(e.target.value)} disabled={submitting} />
                  </div>
                )}
                <div className={clientStyles.modalActions}>
                  <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btnAccent" disabled={submitting}>
                    {submitting ? "Saving..." : editingItem ? "Save Changes" : `Create ${activeType.charAt(0).toUpperCase() + activeType.slice(1)}`}
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

// Relation picker — lazy-fetches matching items as the user types; preserves
// already-selected items so they are visible even when filtered out by the search.
function RelationPicker({
  label,
  kind,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  kind: "developer" | "publisher" | "genre" | "platform" | "theme";
  selected: GameRelationItem[];
  onToggle: (rel: GameRelationItem) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Only fire a search once the user has typed >=3 chars; wait 2s of idle after the last keystroke.
  const debounced = useDebounced(query, 2000);
  const [results, setResults] = useState<GameRelationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reqRef = useRef(0);
  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 3) {
      // Reset stale results and skip the request — modal open / short input should not hit the API.
      setResults([]);
      setLoading(false);
      return;
    }

    const action =
      kind === "developer" ? listDevelopersAction :
      kind === "publisher" ? listPublishersAction :
      kind === "genre" ? listGenresAction :
      kind === "platform" ? listPlatformsAction :
      listThemesAction;

    const reqId = ++reqRef.current;
    setLoading(true);
    action({ page: 1, limit: RELATION_PICKER_LIMIT, q: trimmed }).then((res) => {
      if (reqId !== reqRef.current) return;
      if ("error" in res) {
        setResults([]);
      } else {
        setResults(res.items.map((it: any) => ({ id: it.id, name: it.name, slug: it.slug })));
      }
      setLoading(false);
    });
  }, [debounced, kind]);

  // Merge: selected items (always shown at top) + results not already selected
  const selectedIds = new Set(selected.map((s) => s.id));
  const merged = [
    ...selected,
    ...results.filter((r) => !selectedIds.has(r.id)),
  ];

  return (
    <div className={clientStyles.formGroup}>
      <label className={clientStyles.label}>{label}</label>
      <input
        type="text"
        className={clientStyles.input}
        placeholder={`Search ${label.toLowerCase()} (min 3 chars)...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        style={{ marginBottom: 6 }}
      />
      <div className={clientStyles.checkboxGroupList}>
        {loading && merged.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>Loading…</div>
        ) : merged.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {query.trim().length > 0 && query.trim().length < 3
              ? "Type at least 3 characters."
              : query.trim().length >= 3 && debounced.trim().length < 3
                ? "Waiting…"
                : "No matches."}
          </div>
        ) : (
          merged.map((it) => (
            <label key={it.id} className={clientStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedIds.has(it.id)}
                onChange={() => onToggle(it)}
                disabled={disabled}
              />
              {it.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
