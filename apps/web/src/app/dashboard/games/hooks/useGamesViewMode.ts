import { useEffect, useState } from "react";

const STORAGE_KEY = "gamesViewMode";

export type GamesViewMode = "grid" | "list";

export function useGamesViewMode(): [GamesViewMode, (mode: GamesViewMode) => void] {
  const [mode, setMode] = useState<GamesViewMode>("list");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "grid" || saved === "list") {
      setMode(saved);
    }
  }, []);

  const update = (next: GamesViewMode) => {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return [mode, update];
}
