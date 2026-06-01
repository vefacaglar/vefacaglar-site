"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";
import { useConfirm } from "../components/ConfirmProvider";
import {
  Game,
  GameRelationItem,
  SubTab,
  EntityType,
  RelationKind,
} from "./types";
import { useGamesNavigation } from "./hooks/useGamesNavigation";
import { useGamesViewMode } from "./hooks/useGamesViewMode";
import { useDebounced } from "./hooks/useDebounced";
import { slugify } from "./utils/slugify";
import { toggleRelation } from "./relations";
import { listRelationsOptionsAction } from "./actions";
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
  getGameAction,
  deleteGameAction,
  listDevelopersAction,
  listPublishersAction,
} from "./actions";
import SubTabs from "./components/SubTabs";
import SearchBar from "./components/SearchBar";
import EmptyState from "./components/EmptyState";
import GameCard from "./components/GameCard";
import gameCardStyles from "./components/GameCard.module.css";
import GameCompactRow from "./components/GameCompactRow";
import gameCompactRowStyles from "./components/GameCompactRow.module.css";
import ProfileCard from "./components/ProfileCard";
import profileCardStyles from "./components/ProfileCard.module.css";
import InteractiveChip from "./components/InteractiveChip";
import interactiveChipStyles from "./components/InteractiveChip.module.css";
import GamesPagination from "./components/GamesPagination";
import pendingOverlayStyles from "./components/PendingOverlay.module.css";
import EntityFormModal from "./components/EntityFormModal";
import GameFieldsForm, { GameFieldsState } from "./components/GameFieldsForm";
import RelationsGrid from "./components/RelationsGrid";
import SimpleEntityForm from "./components/SimpleEntityForm";
import formsStyles from "./components/forms.module.css";

const SECTION_TITLES: Record<SubTab, string> = {
  games: ds.games.sections.games,
  developers: ds.games.sections.developers,
  publishers: ds.games.sections.publishers,
  genres: ds.games.sections.genres,
  themes: ds.games.sections.themes,
  platforms: ds.games.sections.platforms,
};

const ADD_BUTTON_LABELS: Record<SubTab, string> = {
  games: ds.games.buttons.newGame,
  developers: ds.games.buttons.newDeveloper,
  publishers: ds.games.buttons.newPublisher,
  genres: ds.games.buttons.newGenre,
  themes: ds.games.buttons.newTheme,
  platforms: ds.games.buttons.newPlatform,
};

const SUB_TAB_TO_ENTITY: Record<SubTab, EntityType> = {
  games: "game",
  developers: "developer",
  publishers: "publisher",
  genres: "genre",
  themes: "theme",
  platforms: "platform",
};

const NO_PAGINATION_TABS: SubTab[] = ["genres", "themes", "platforms"];

const EMPTY_GAME_FIELDS: GameFieldsState = {
  title: "",
  slug: "",
  originalTitle: "",
  description: "",
  coverImageUrl: "",
  releaseDate: "",
  metacriticScore: "",
  openCriticScore: "",
  hltbMainHours: "",
  hltbMainExtraHours: "",
  hltbCompletionistHours: "",
};

interface GamesDashboardClientProps {
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
  const [, startTransition] = useTransition();
  const customConfirm = useConfirm();

  const nav = useGamesNavigation({
    initialTab,
    initialPage,
    initialLimit,
    initialSearch,
    initialTotal,
  });

  const [viewMode, setViewMode] = useGamesViewMode();
  const items: any[] = initialItems;
  const total = initialTotal;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<EntityType>("game");
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const [options, setOptions] = useState<{
    genres: GameRelationItem[];
    themes: GameRelationItem[];
    platforms: GameRelationItem[];
  } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const [gameFields, setGameFields] = useState<GameFieldsState>(EMPTY_GAME_FIELDS);
  const updateGameField = <K extends keyof GameFieldsState>(key: K, value: GameFieldsState[K]) => {
    setGameFields((prev) => ({ ...prev, [key]: value }));
  };

  const [selectedDevelopers, setSelectedDevelopers] = useState<GameRelationItem[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<GameRelationItem[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<GameRelationItem[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<GameRelationItem[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<GameRelationItem[]>([]);

  useEffect(() => {
    if (isModalOpen && activeType === "game" && !options) {
      setOptionsLoading(true);
      listRelationsOptionsAction().then((res) => {
        if (res && "error" in res) {
          setError(res.error);
        } else {
          setOptions(res);
        }
        setOptionsLoading(false);
      });
    }
  }, [isModalOpen, activeType, options]);

  const debouncedGameTitle = useDebounced(gameFields.title, 400);
  const debouncedName = useDebounced(name, 400);
  useEffect(() => {
    if (editingItem) return;
    if (activeType === "game") {
      if (gameFields.title !== debouncedGameTitle) return;
      setSlug(slugify(gameFields.title));
    } else {
      if (name !== debouncedName) return;
      setSlug(slugify(name));
    }
  }, [debouncedGameTitle, debouncedName, activeType, editingItem, gameFields.title, name]);

  function resetFormState() {
    setName("");
    setSlug("");
    setCountryCode("");
    setGameFields(EMPTY_GAME_FIELDS);
    setSelectedDevelopers([]);
    setSelectedPublishers([]);
    setSelectedGenres([]);
    setSelectedPlatforms([]);
    setSelectedThemes([]);
  }

  const openAddModal = (type: EntityType) => {
    setActiveType(type);
    setEditingItem(null);
    resetFormState();
    setError(null);
    setIsModalOpen(true);
  };

  const populateGameForm = (game: Game) => {
    setEditingItem(game);
    setGameFields({
      title: game.title,
      slug: game.slug,
      originalTitle: game.originalTitle || "",
      description: game.description || "",
      coverImageUrl: game.coverImageUrl || "",
      releaseDate: game.releaseDate || "",
      metacriticScore: game.metacriticScore !== null ? game.metacriticScore : "",
      openCriticScore: game.openCriticScore !== null ? game.openCriticScore : "",
      hltbMainHours: game.hltbMainHours || "",
      hltbMainExtraHours: game.hltbMainExtraHours || "",
      hltbCompletionistHours: game.hltbCompletionistHours || "",
    });
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
      populateGameForm(item as Game);
      const res = await getGameAction(item.id);
      if (res && typeof res === "object" && "error" in res) {
        setError((res as { error: string }).error || ds.games.errors.loadFailed);
      } else {
        populateGameForm(res as Game);
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

  const handleToggleRelation = (kind: RelationKind, rel: GameRelationItem) => {
    const stateMap: Record<RelationKind, { selected: GameRelationItem[]; setSelected: React.Dispatch<React.SetStateAction<GameRelationItem[]>> }> = {
      developers: { selected: selectedDevelopers, setSelected: setSelectedDevelopers },
      publishers: { selected: selectedPublishers, setSelected: setSelectedPublishers },
      genres: { selected: selectedGenres, setSelected: setSelectedGenres },
      platforms: { selected: selectedPlatforms, setSelected: setSelectedPlatforms },
      themes: { selected: selectedThemes, setSelected: setSelectedThemes },
    };
    const entry = stateMap[kind];
    void toggleRelation({
      relation: rel,
      selected: entry.selected,
      setSelected: entry.setSelected,
      relationType: kind,
      gameId: editingItem?.id ?? null,
      setError,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeType === "game") {
      if (!gameFields.title.trim()) { setError(ds.games.errors.titleRequired); return; }
    } else {
      if (!name.trim()) { setError(ds.games.errors.nameRequired); return; }
    }
    if (!slug.trim()) { setError(ds.games.errors.slugRequired); return; }

    setSubmitting(true);
    setError(null);

    let res: { error?: string } | undefined;

    if (activeType === "game") {
      const baseFields = {
        title: gameFields.title.trim(),
        slug: slug.trim(),
        originalTitle: gameFields.originalTitle.trim() || null,
        description: gameFields.description.trim() || null,
        coverImageUrl: gameFields.coverImageUrl.trim() || null,
        releaseDate: gameFields.releaseDate.trim() || null,
        metacriticScore: gameFields.metacriticScore !== "" ? Number(gameFields.metacriticScore) : null,
        openCriticScore: gameFields.openCriticScore !== "" ? Number(gameFields.openCriticScore) : null,
        hltbMainHours: gameFields.hltbMainHours !== "" ? String(gameFields.hltbMainHours) : null,
        hltbMainExtraHours: gameFields.hltbMainExtraHours !== "" ? String(gameFields.hltbMainExtraHours) : null,
        hltbCompletionistHours: gameFields.hltbCompletionistHours !== "" ? String(gameFields.hltbCompletionistHours) : null,
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
      return;
    }

    closeModal();
    setSubmitting(false);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleDelete = async (type: EntityType, id: string, itemName: string) => {
    if (!await customConfirm(
      ds.games.deleteConfirm.replace("{type}", type).replace("{itemName}", itemName),
      { title: ds.games.modalTitle.edit.replace("{type}", type) }
    )) return;

    let res: { error?: string } | undefined;
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

  const submitButtonLabel = (() => {
    if (submitting) return ds.games.buttons.saving;
    if (editingItem) return ds.games.buttons.saveChanges;
    if (activeType === "game") return ds.games.buttons.createGame;
    if (activeType === "developer") return ds.games.buttons.createDeveloper;
    if (activeType === "publisher") return ds.games.buttons.createPublisher;
    if (activeType === "genre") return ds.games.buttons.createGenre;
    if (activeType === "theme") return ds.games.buttons.createTheme;
    return ds.games.buttons.createPlatform;
  })();

  const showGamesViewToggle = nav.activeSubTab === "games";
  const showPagination = !NO_PAGINATION_TABS.includes(nav.activeSubTab);
  const editHrefFor = (game: Game) =>
    `/dashboard/games/edit/${game.id}?returnUrl=${encodeURIComponent(nav.getReturnUrl())}`;

  return (
    <div>
      <SubTabs
        activeTab={nav.activeSubTab}
        counts={nav.counts}
        onChange={nav.handleTabChange}
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{SECTION_TITLES[nav.activeSubTab]}</h2>
          <Button
            variant="accent"
            onClick={() => openAddModal(SUB_TAB_TO_ENTITY[nav.activeSubTab])}
          >
            {ADD_BUTTON_LABELS[nav.activeSubTab]}
          </Button>
        </div>

        <SearchBar
          activeTab={nav.activeSubTab}
          searchQuery={nav.searchQuery}
          onSearchChange={nav.setSearchQuery}
          onSearchSubmit={() => nav.navigateTo({ page: 1, q: nav.searchQuery })}
          viewMode={showGamesViewToggle ? viewMode : undefined}
          onViewModeChange={showGamesViewToggle ? setViewMode : undefined}
        />

        <div className={`${pendingOverlayStyles.pendingOverlay} ${nav.isPending ? pendingOverlayStyles.pendingOverlayActive : ""}`}>
          {items.length === 0 && (
            <EmptyState
              message={
                initialSearch
                  ? ds.games.empty.noMatch.replace("{type}", nav.activeSubTab).replace("{q}", initialSearch)
                  : ds.games.empty.noResults.replace("{type}", nav.activeSubTab)
              }
            />
          )}

          {items.length > 0 && nav.activeSubTab === "games" && (
            viewMode === "grid" ? (
              <div className={gameCardStyles.gamesGrid}>
                {(items as Game[]).map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    editHref={editHrefFor(game)}
                    onDelete={(g) => handleDelete("game", g.id, g.title)}
                  />
                ))}
              </div>
            ) : (
              <div className={gameCompactRowStyles.gamesCompactList}>
                {(items as Game[]).map((game) => (
                  <GameCompactRow
                    key={game.id}
                    game={game}
                    editHref={editHrefFor(game)}
                    onDelete={(g) => handleDelete("game", g.id, g.title)}
                  />
                ))}
              </div>
            )
          )}

          {items.length > 0 && (nav.activeSubTab === "developers" || nav.activeSubTab === "publishers") && (
            <div className={profileCardStyles.profileCardsGrid}>
              {items.map((it) => {
                const t: "developer" | "publisher" =
                  nav.activeSubTab === "developers" ? "developer" : "publisher";
                return (
                  <ProfileCard
                    key={it.id}
                    item={it}
                    type={t}
                    onEdit={openEditModal}
                    onDelete={(type, item) => handleDelete(type, item.id, item.name)}
                  />
                );
              })}
            </div>
          )}

          {items.length > 0 && (nav.activeSubTab === "genres" || nav.activeSubTab === "themes" || nav.activeSubTab === "platforms") && (
            <div className={interactiveChipStyles.interactiveChipsGrid}>
              {items.map((it) => {
                const t: "genre" | "theme" | "platform" =
                  nav.activeSubTab === "genres" ? "genre" :
                  nav.activeSubTab === "themes" ? "theme" : "platform";
                return (
                  <InteractiveChip
                    key={it.id}
                    item={it}
                    type={t}
                    onEdit={openEditModal}
                    onDelete={(type, item) => handleDelete(type, item.id, item.name)}
                  />
                );
              })}
            </div>
          )}

          {showPagination && (
            <GamesPagination
              page={nav.page}
              pageSize={nav.pageSize}
              total={total}
              onPageChange={nav.handlePageChange}
              onPageSizeChange={nav.handlePageSizeChange}
            />
          )}
        </div>
      </section>

      {isModalOpen && (
        <EntityFormModal
          activeType={activeType}
          editing={!!editingItem}
          error={error}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            {activeType === "game" ? (
              <>
                <div className={formsStyles.formGrid}>
                  <GameFieldsForm
                    values={gameFields}
                    onChange={updateGameField}
                    disabled={submitting}
                    showPlaceholders
                  />
                  <RelationsGrid
                    toggle={handleToggleRelation}
                    fetchDevelopers={(p) => listDevelopersAction(p)}
                    fetchPublishers={(p) => listPublishersAction(p)}
                    isLoading={optionsLoading}
                    options={options}
                    selectedDevelopers={selectedDevelopers}
                    selectedPublishers={selectedPublishers}
                    selectedGenres={selectedGenres}
                    selectedPlatforms={selectedPlatforms}
                    selectedThemes={selectedThemes}
                    disabled={submitting}
                  />
                </div>
                <div className={formsStyles.formActions}>
                  <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                    {ds.games.buttons.cancel}
                  </Button>
                  <Button type="submit" variant="accent" disabled={submitting}>
                    {submitButtonLabel}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <SimpleEntityForm
                  activeType={activeType}
                  name={name}
                  onNameChange={setName}
                  slug={slug}
                  onSlugChange={setSlug}
                  countryCode={countryCode}
                  onCountryCodeChange={setCountryCode}
                  disabled={submitting}
                />
                <div className={formsStyles.formActions}>
                  <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>
                    {ds.games.buttons.cancel}
                  </Button>
                  <Button type="submit" variant="accent" disabled={submitting}>
                    {submitButtonLabel}
                  </Button>
                </div>
              </>
            )}
          </form>
        </EntityFormModal>
      )}
    </div>
  );
}
