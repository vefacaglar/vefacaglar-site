import { OWNER_RANKING_CONFIG as config } from "./owner-ranking.config";
import type { OwnerRankingBreakdown, OwnerRankingSource } from "./owner-ranking.types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** A fixed taste blend over the existing percentile-based current-interest score. */
export function ownerRankingBreakdown(source: OwnerRankingSource): OwnerRankingBreakdown {
  const modes = source.gameModeIds ?? [];
  const singlePlayer = modes.includes(config.singlePlayerMode);
  const verifiedMultiplayer = modes.some((mode) => (config.multiplayerModes as readonly number[]).includes(mode));
  const affinityContributions = {
    action: source.hasAction ? config.affinity.action : 0,
    rpg: source.hasRpg ? config.affinity.rpg : 0,
    openWorld: source.hasOpenWorld ? config.affinity.openWorld : 0,
    singlePlayer: singlePlayer ? config.affinity.singlePlayer : 0,
    preferredCombination: source.hasRpg && source.hasOpenWorld && singlePlayer ? config.affinity.preferredCombination : 0,
    multiplayerOnlyPenalty: verifiedMultiplayer && !singlePlayer ? -config.affinity.multiplayerOnlyPenalty : 0,
  };
  const affinityScore = clamp(Object.values(affinityContributions).reduce((sum, value) => sum + value, 0));
  const interestScore = source.popularityScore != null && Number.isFinite(source.popularityScore)
    ? clamp(source.popularityScore) : null;
  const weightedContributions = {
    affinity: affinityScore * config.affinityWeight,
    interest: (interestScore ?? 0) * config.interestWeight,
  };
  return {
    version: config.version,
    score: clamp(weightedContributions.affinity + weightedContributions.interest),
    affinityScore,
    interestScore,
    affinityContributions,
    weightedContributions,
  };
}
