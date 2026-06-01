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
  title: string;
  slug: string;
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
export type EntityType = "game" | "developer" | "publisher" | "genre" | "theme" | "platform";

export type RelationKind = "developers" | "publishers" | "genres" | "platforms" | "themes";

export interface RelationsState {
  developers: GameRelationItem[];
  publishers: GameRelationItem[];
  genres: GameRelationItem[];
  platforms: GameRelationItem[];
  themes: GameRelationItem[];
}
