"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  listDevelopersAction,
  listGenresAction,
  listPlatformsAction,
  listPublishersAction,
  listThemesAction,
  updateGameAction,
} from "./actions";
import type { Game, GameRelationItem } from "./GamesDashboardClient";
import clientStyles from "./games-client.module.css";

const RELATION_PICKER_LIMIT = 50;

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GameEditForm({ game, returnUrl = "/dashboard/games" }: { game: Game; returnUrl?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(game.title);
  const [slug, setSlug] = useState(game.slug);
  const [originalTitle, setOriginalTitle] = useState(game.originalTitle || "");
  const [description, setDescription] = useState(game.description || "");
  const [coverImageUrl, setCoverImageUrl] = useState(game.coverImageUrl || "");
  const [releaseDate, setReleaseDate] = useState(game.releaseDate || "");
  const [metacriticScore, setMetacriticScore] = useState<number | "">(game.metacriticScore ?? "");
  const [openCriticScore, setOpenCriticScore] = useState<number | "">(game.openCriticScore ?? "");
  const [hltbMainHours, setHltbMainHours] = useState<string | number>(game.hltbMainHours || "");
  const [hltbMainExtraHours, setHltbMainExtraHours] = useState<string | number>(game.hltbMainExtraHours || "");
  const [hltbCompletionistHours, setHltbCompletionistHours] = useState<string | number>(game.hltbCompletionistHours || "");

  const [selectedDevelopers, setSelectedDevelopers] = useState<GameRelationItem[]>(game.developers);
  const [selectedPublishers, setSelectedPublishers] = useState<GameRelationItem[]>(game.publishers);
  const [selectedGenres, setSelectedGenres] = useState<GameRelationItem[]>(game.genres);
  const [selectedPlatforms, setSelectedPlatforms] = useState<GameRelationItem[]>(game.platforms);
  const [selectedThemes, setSelectedThemes] = useState<GameRelationItem[]>(game.themes);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

    try {
      const res = await fetch(`/api/games/games/${game.id}/${relationType}/${relation.id}`, {
        method: isSelected ? "DELETE" : "POST",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSelected(selected);
        setError(errData.message || `Failed to ${isSelected ? "unlink" : "link"} ${relationType.slice(0, -1)}.`);
      }
    } catch {
      setSelected(selected);
      setError("Server connection error.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await updateGameAction(game.id, {
      title: title.trim(),
      slug: slug.trim(),
      originalTitle: originalTitle.trim() ? originalTitle.trim() : null,
      description: description.trim() ? description.trim() : null,
      coverImageUrl: coverImageUrl.trim() ? coverImageUrl.trim() : null,
      releaseDate: releaseDate.trim() ? releaseDate.trim() : null,
      metacriticScore: metacriticScore !== "" ? Number(metacriticScore) : null,
      openCriticScore: openCriticScore !== "" ? Number(openCriticScore) : null,
      hltbMainHours: hltbMainHours !== "" ? String(hltbMainHours) : null,
      hltbMainExtraHours: hltbMainExtraHours !== "" ? String(hltbMainExtraHours) : null,
      hltbCompletionistHours: hltbCompletionistHours !== "" ? String(hltbCompletionistHours) : null,
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
    <div className={clientStyles.editPageWrapper}>
      <div className={clientStyles.editPageBack}>
        <Link href={returnUrl} className="backLink">← back to games</Link>
      </div>

      <div className={clientStyles.editPageHeader}>
        <h1 className={clientStyles.editPageTitle}>Edit Game</h1>
      </div>

      <form onSubmit={handleSubmit} className={clientStyles.editPagePanel}>
        {error && <div className={clientStyles.errorMsg}>{error}</div>}
        <div className={clientStyles.formGrid}>
          <div>
            <div className={clientStyles.formSectionTitle}>Core Info</div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-title">Title</label>
              <input id="game-title" type="text" className={clientStyles.input} value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} required autoFocus />
            </div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-slug">Slug</label>
              <input id="game-slug" type="text" className={clientStyles.input} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={submitting} required />
            </div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-original-title">Original Title (Optional)</label>
              <input id="game-original-title" type="text" className={clientStyles.input} value={originalTitle} onChange={(e) => setOriginalTitle(e.target.value)} disabled={submitting} />
            </div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-description">Description (Optional)</label>
              <textarea id="game-description" className={clientStyles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} />
            </div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-cover-image">Cover Image URL (Optional)</label>
              <input id="game-cover-image" type="text" className={clientStyles.input} value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} disabled={submitting} />
            </div>
            <div className={clientStyles.formGroup}>
              <label className={clientStyles.label} htmlFor="game-release-date">Release Date (Optional)</label>
              <input id="game-release-date" type="date" className={clientStyles.input} value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} disabled={submitting} />
            </div>
            <div className={clientStyles.rowFields}>
              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="game-metacritic">Metacritic Score (Optional)</label>
                <input id="game-metacritic" type="number" min={0} max={100} className={clientStyles.input} value={metacriticScore} onChange={(e) => setMetacriticScore(e.target.value === "" ? "" : Number(e.target.value))} disabled={submitting} />
              </div>
              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="game-opencritic">OpenCritic Score (Optional)</label>
                <input id="game-opencritic" type="number" min={0} max={100} className={clientStyles.input} value={openCriticScore} onChange={(e) => setOpenCriticScore(e.target.value === "" ? "" : Number(e.target.value))} disabled={submitting} />
              </div>
            </div>
            <div className={clientStyles.rowThreeFields}>
              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="game-hltb-main">HLTB Main (h)</label>
                <input id="game-hltb-main" type="text" className={clientStyles.input} value={hltbMainHours} onChange={(e) => setHltbMainHours(e.target.value)} disabled={submitting} />
              </div>
              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="game-hltb-extra">HLTB Main+Ex (h)</label>
                <input id="game-hltb-extra" type="text" className={clientStyles.input} value={hltbMainExtraHours} onChange={(e) => setHltbMainExtraHours(e.target.value)} disabled={submitting} />
              </div>
              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="game-hltb-comp">HLTB Comp (h)</label>
                <input id="game-hltb-comp" type="text" className={clientStyles.input} value={hltbCompletionistHours} onChange={(e) => setHltbCompletionistHours(e.target.value)} disabled={submitting} />
              </div>
            </div>
          </div>

          <div>
            <div className={clientStyles.formSectionTitle}>Relations</div>
            <div className={clientStyles.relationsGrid}>
              <RelationPicker label="Developers" kind="developer" selected={selectedDevelopers} onToggle={(rel) => toggleRelation(rel, selectedDevelopers, setSelectedDevelopers, "developers")} disabled={submitting} />
              <RelationPicker label="Publishers" kind="publisher" selected={selectedPublishers} onToggle={(rel) => toggleRelation(rel, selectedPublishers, setSelectedPublishers, "publishers")} disabled={submitting} />
              <RelationPicker label="Genres" kind="genre" selected={selectedGenres} onToggle={(rel) => toggleRelation(rel, selectedGenres, setSelectedGenres, "genres")} disabled={submitting} />
              <RelationPicker label="Platforms" kind="platform" selected={selectedPlatforms} onToggle={(rel) => toggleRelation(rel, selectedPlatforms, setSelectedPlatforms, "platforms")} disabled={submitting} />
              <RelationPicker label="Themes" kind="theme" selected={selectedThemes} onToggle={(rel) => toggleRelation(rel, selectedThemes, setSelectedThemes, "themes")} disabled={submitting} />
            </div>
          </div>
        </div>

        <div className={clientStyles.modalActions}>
          <Link href={returnUrl} className={clientStyles.btnCancel}>Cancel</Link>
          <button type="submit" className="btnAccent" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</button>
        </div>
      </form>
    </div>
  );
}

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
  const debounced = useDebounced(query, 2000);
  const [results, setResults] = useState<GameRelationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reqRef = useRef(0);
  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 3) {
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
            {query.trim().length > 0 && query.trim().length < 3 ? "Type at least 3 characters." : "No matches."}
          </div>
        ) : (
          merged.map((it) => (
            <label key={it.id} className={clientStyles.checkboxLabel}>
              <input type="checkbox" checked={selectedIds.has(it.id)} onChange={() => onToggle(it)} disabled={disabled} />
              {it.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
