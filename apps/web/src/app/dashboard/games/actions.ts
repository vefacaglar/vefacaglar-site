"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";

export async function createDeveloperAction(data: {
  name: string;
  slug: string;
  countryCode?: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/developers", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create developer." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create developer error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateDeveloperAction(
  id: string,
  data: {
    name?: string;
    slug?: string;
    countryCode?: string | null;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/developers/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update developer." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update developer error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteDeveloperAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/developers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete developer." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete developer error:", error);
    return { error: "Server connection error." };
  }
}

export async function createPublisherAction(data: {
  name: string;
  slug: string;
  countryCode?: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/publishers", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create publisher." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create publisher error:", error);
    return { error: "Server connection error." };
  }
}

export async function updatePublisherAction(
  id: string,
  data: {
    name?: string;
    slug?: string;
    countryCode?: string | null;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/publishers/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update publisher." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update publisher error:", error);
    return { error: "Server connection error." };
  }
}

export async function deletePublisherAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/publishers/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete publisher." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete publisher error:", error);
    return { error: "Server connection error." };
  }
}

export async function createGenreAction(data: {
  name: string;
  slug: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/genres", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create genre." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create genre error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateGenreAction(
  id: string,
  data: {
    name?: string;
    slug?: string;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/genres/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update genre." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update genre error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteGenreAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/genres/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete genre." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete genre error:", error);
    return { error: "Server connection error." };
  }
}

export async function createThemeAction(data: {
  name: string;
  slug: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/themes", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create theme." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create theme error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateThemeAction(
  id: string,
  data: {
    name?: string;
    slug?: string;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/themes/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update theme." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update theme error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteThemeAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/themes/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete theme." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete theme error:", error);
    return { error: "Server connection error." };
  }
}

export async function createPlatformAction(data: {
  name: string;
  slug: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/platforms", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create platform." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create platform error:", error);
    return { error: "Server connection error." };
  }
}

export async function updatePlatformAction(
  id: string,
  data: {
    name?: string;
    slug?: string;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/platforms/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update platform." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update platform error:", error);
    return { error: "Server connection error." };
  }
}

export async function deletePlatformAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/platforms/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete platform." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete platform error:", error);
    return { error: "Server connection error." };
  }
}

export async function createGameAction(data: {
  title: string;
  slug: string;
  originalTitle?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  releaseDate?: string | null;
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  hltbMainHours?: string | number | null;
  hltbMainExtraHours?: string | number | null;
  hltbCompletionistHours?: string | number | null;
  developerIds?: string[];
  publisherIds?: string[];
  genreIds?: string[];
  platformIds?: string[];
  themeIds?: string[];
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/games/games", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create game." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Create game error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateGameAction(
  id: string,
  data: {
    title?: string;
    slug?: string;
    originalTitle?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    releaseDate?: string | null;
    metacriticScore?: number | null;
    openCriticScore?: number | null;
    hltbMainHours?: string | number | null;
    hltbMainExtraHours?: string | number | null;
    hltbCompletionistHours?: string | number | null;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/games/games/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update game." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Update game error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteGameAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/games/games/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete game." };
    }

    revalidatePath("/dashboard/games");
    return { success: true };
  } catch (error) {
    console.error("Delete game error:", error);
    return { error: "Server connection error." };
  }
}

// --- List actions (server-side paginated/searched fetch) ---

type ListParams = { page?: number; limit?: number; q?: string };
type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function listProxy<T>(path: string, params: ListParams): Promise<ListResult<T> | { error: string }> {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.q && params.q.trim()) search.set("q", params.q.trim());
  const qs = search.toString();
  const url = qs ? `${path}?${qs}` : path;

  try {
    const res = await httpClient.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to fetch list." };
    }
    return (await res.json()) as ListResult<T>;
  } catch (error) {
    console.error("List fetch error:", path, error);
    return { error: "Server connection error." };
  }
}

async function getProxy<T>(path: string): Promise<T | { error: string }> {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.get(path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to fetch." };
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error("Get proxy fetch error:", path, error);
    return { error: "Server connection error." };
  }
}

export async function listGamesAction(params: ListParams) {
  return listProxy("/api/games/games", params);
}
export async function listDevelopersAction(params: ListParams) {
  return listProxy("/api/games/developers", params);
}
export async function listPublishersAction(params: ListParams) {
  return listProxy("/api/games/publishers", params);
}
export async function listGenresAction(params: ListParams) {
  return listProxy("/api/games/genres", params);
}
export async function listThemesAction(params: ListParams) {
  return listProxy("/api/games/themes", params);
}
export async function listPlatformsAction(params: ListParams) {
  return listProxy("/api/games/platforms", params);
}
export async function listRelationsOptionsAction() {
  return getProxy<{
    genres: { id: string; name: string; slug: string }[];
    themes: { id: string; name: string; slug: string }[];
    platforms: { id: string; name: string; slug: string }[];
  }>("/api/games/relations-options");
}
