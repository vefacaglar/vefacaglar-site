import { cache } from "react";
import { httpClient } from "./httpClient";
export type PersonCredit = {
  title: string; releaseYear: number | null; roles: ("cast" | "director" | "producer")[];
  characters: string[]; voice: boolean; self: boolean;
} & ({ kind: "film"; id: string; slug: string } | { kind: "tv_series"; id: number });
export interface PersonPage {
  person: { id: string; name: string; wikidataId: string | null; birthDate: string | null; deathDate: string | null;
    gender: string | null; country: string | null; sources: { provider: "tvmaze"; sourceUrl: string }[] };
  items: PersonCredit[]; total: number; page: number; limit: number; totalPages: number;
}
export function personId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : null;
}
async function personJson<T>(path: string): Promise<T | null> {
  const response = await httpClient.get(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Person data fetch failed: ${response.status}`);
  return response.json() as Promise<T>;
}
export const getPerson = cache((id: string, page = 1) => personId(id)
  ? personJson<PersonPage>(`/api/people/${encodeURIComponent(id)}?${new URLSearchParams({ page: String(page), limit: "24" })}`)
  : Promise.resolve(null));
export const resolvePerson = cache((wikidataId: string) => /^Q[1-9][0-9]{0,20}$/.test(wikidataId)
  ? personJson<{ id: string }>(`/api/people/resolve/${encodeURIComponent(wikidataId)}`) : Promise.resolve(null));
export function personHref(id: string): string { return `/explore/people/${encodeURIComponent(id)}`; }
export function personCreditHref(credit: PersonCredit): string {
  return credit.kind === "film" ? `/explore/movies/${encodeURIComponent(credit.slug)}` : `/explore/tv-series/${credit.id}`;
}
export function personCreditRoles(credit: PersonCredit): string {
  const labels = { cast: "Cast", director: "Director", producer: "Producer" };
  const roles = credit.roles.filter((role) => role !== "cast" || credit.characters.length === 0).map((role) => labels[role]);
  return [...roles, credit.characters.length ? credit.characters.join(", ") : null,
    credit.voice ? "Voice" : null, credit.self ? "Self" : null].filter(Boolean).join(" · ");
}
