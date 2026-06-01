"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "../../../components/Button";
import { Game, GameRelationItem, RelationKind } from "./types";
import { toggleRelation } from "./relations";
import {
  listDevelopersAction,
  listPublishersAction,
  listRelationsOptionsAction,
  updateGameAction,
} from "./actions";
import styles from "./edit-page.module.css";
import formsStyles from "./components/forms.module.css";
import GameFieldsForm, { GameFieldsState } from "./components/GameFieldsForm";
import RelationsGrid from "./components/RelationsGrid";
import ds from "../../../lib/dashboard-strings";

function gameToFields(game: Game): GameFieldsState {
  return {
    title: game.title,
    slug: game.slug,
    originalTitle: game.originalTitle || "",
    description: game.description || "",
    coverImageUrl: game.coverImageUrl || "",
    releaseDate: game.releaseDate || "",
    metacriticScore: game.metacriticScore ?? "",
    openCriticScore: game.openCriticScore ?? "",
    hltbMainHours: game.hltbMainHours || "",
    hltbMainExtraHours: game.hltbMainExtraHours || "",
    hltbCompletionistHours: game.hltbCompletionistHours || "",
  };
}

export default function GameEditForm({
  game,
  returnUrl = "/dashboard/games",
}: {
  game: Game;
  returnUrl?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<GameFieldsState>(gameToFields(game));
  const [selectedDevelopers, setSelectedDevelopers] = useState<GameRelationItem[]>(game.developers);
  const [selectedPublishers, setSelectedPublishers] = useState<GameRelationItem[]>(game.publishers);
  const [selectedGenres, setSelectedGenres] = useState<GameRelationItem[]>(game.genres);
  const [selectedPlatforms, setSelectedPlatforms] = useState<GameRelationItem[]>(game.platforms);
  const [selectedThemes, setSelectedThemes] = useState<GameRelationItem[]>(game.themes);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [options, setOptions] = useState<{
    genres: GameRelationItem[];
    themes: GameRelationItem[];
    platforms: GameRelationItem[];
  } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  useEffect(() => {
    setOptionsLoading(true);
    listRelationsOptionsAction().then((res) => {
      if ("error" in res) {
        setError(res.error);
      } else {
        setOptions(res);
      }
      setOptionsLoading(false);
    });
  }, []);

  const updateField = <K extends keyof GameFieldsState>(key: K, value: GameFieldsState[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
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
      gameId: game.id,
      setError,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.title.trim()) {
      setError(ds.games.errors.titleRequired);
      return;
    }
    if (!fields.slug.trim()) {
      setError(ds.games.errors.slugRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await updateGameAction(game.id, {
      title: fields.title.trim(),
      slug: fields.slug.trim(),
      originalTitle: fields.originalTitle.trim() || null,
      description: fields.description.trim() || null,
      coverImageUrl: fields.coverImageUrl.trim() || null,
      releaseDate: fields.releaseDate.trim() || null,
      metacriticScore: fields.metacriticScore !== "" ? Number(fields.metacriticScore) : null,
      openCriticScore: fields.openCriticScore !== "" ? Number(fields.openCriticScore) : null,
      hltbMainHours: fields.hltbMainHours !== "" ? String(fields.hltbMainHours) : null,
      hltbMainExtraHours: fields.hltbMainExtraHours !== "" ? String(fields.hltbMainExtraHours) : null,
      hltbCompletionistHours: fields.hltbCompletionistHours !== "" ? String(fields.hltbCompletionistHours) : null,
    });

    if (res.error) {
      setError(res.error);
      setSubmitting(false);
      return;
    }

    router.push(returnUrl);
    router.refresh();
  };

  return (
    <div className={styles.editPageWrapper}>
      <div className={styles.editPageBack}>
        <Link href={returnUrl} className="backLink">{ds.games.backToGames}</Link>
      </div>

      <div className={styles.editPageHeader}>
        <h1 className={styles.editPageTitle}>{ds.games.editGame}</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.editPagePanel}>
        {error && <div className={formsStyles.errorMsg}>{error}</div>}
        <div className={formsStyles.formGrid}>
          <GameFieldsForm
            values={fields}
            onChange={updateField}
            disabled={submitting}
            showPlaceholders={false}
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
          <Button href={returnUrl} variant="ghost">{ds.games.buttons.cancel}</Button>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? ds.games.buttons.saving : ds.games.buttons.saveChanges}
          </Button>
        </div>
      </form>
    </div>
  );
}
