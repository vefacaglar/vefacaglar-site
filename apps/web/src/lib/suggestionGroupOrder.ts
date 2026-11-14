// Client-safe: shared by the movie and game search boxes.

/**
 * The API's suggestion group order (best-matching group first) when it lists each
 * known group exactly once; otherwise the box's default order.
 */
export function suggestionGroupOrder<G extends string>(value: unknown, fallback: readonly G[]): G[] {
  return Array.isArray(value) && value.length === fallback.length && fallback.every((group) => value.includes(group))
    ? (value as G[])
    : [...fallback];
}
