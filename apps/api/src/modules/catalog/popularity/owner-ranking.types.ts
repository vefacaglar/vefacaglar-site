export type OwnerRankingSource = {
  id: string;
  hasAction: boolean;
  hasRpg: boolean;
  hasOpenWorld: boolean;
  /** null means unchecked; an empty array is a verified absence of modes. */
  gameModeIds: number[] | null;
  popularityScore: number | null;
  recommendationScore: number | null;
};

export type GameModeCursor = { id: string; popularityScore: number | null };
export type GameModeCandidate = GameModeCursor & { igdbId: number };
export type GameModeBackfillResult = {
  checkedCount: number;
  status: "complete" | "budget" | "unavailable";
};

export type OwnerRankingBreakdown = {
  version: string;
  score: number;
  affinityScore: number;
  interestScore: number | null;
  affinityContributions: {
    action: number;
    rpg: number;
    openWorld: number;
    singlePlayer: number;
    preferredCombination: number;
    multiplayerOnlyPenalty: number;
  };
  weightedContributions: { affinity: number; interest: number };
};
export type OwnerRankingInspection = { source: OwnerRankingSource; breakdown: OwnerRankingBreakdown };
