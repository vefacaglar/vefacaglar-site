/** Owner preferences, not IGDB's homepage formula or per-user settings. */
export const OWNER_RANKING_CONFIG = {
  version: "owner-taste-v1",
  affinity: {
    action: 0.15,
    rpg: 0.25,
    openWorld: 0.25,
    singlePlayer: 0.20,
    preferredCombination: 0.15,
    multiplayerOnlyPenalty: 0.25,
  },
  affinityWeight: 0.65,
  interestWeight: 0.35,
  singlePlayerMode: 1,
  multiplayerModes: [2, 3, 4, 5, 6],
  modeRefreshDays: 90,
  modeBatchSize: 500,
  modeMaxBatches: 20,
  modeBudgetMs: 30_000,
} as const;
