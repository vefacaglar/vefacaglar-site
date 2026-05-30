"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../../lib/httpClient";

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

export async function listPackagesAction(params: ListParams) {
  return listProxy<any>("/api/packages/dashboard", params);
}

export async function createPackageAction(data: {
  name: string;
  slug: string;
  description?: string;
  nugetUrl?: string;
  npmUrl?: string;
  githubUrl?: string;
  docs?: string;
  latestVersion?: string;
  isActive?: boolean;
  content?: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/packages/dashboard", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create package." };
    }

    revalidatePath("/dashboard/packages");
    return { success: true };
  } catch (error) {
    console.error("Create package error:", error);
    return { error: "Server connection error." };
  }
}

export async function updatePackageAction(
  id: string,
  data: {
    name: string;
    slug: string;
    description?: string | null;
    nugetUrl?: string | null;
    npmUrl?: string | null;
    githubUrl?: string | null;
    docs?: string | null;
    latestVersion?: string;
    isActive?: boolean;
    content?: string;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/packages/dashboard/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update package." };
    }

    revalidatePath("/dashboard/packages");
    return { success: true };
  } catch (error) {
    console.error("Update package error:", error);
    return { error: "Server connection error." };
  }
}

export async function deletePackageAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/packages/dashboard/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete package." };
    }

    revalidatePath("/dashboard/packages");
    return { success: true };
  } catch (error) {
    console.error("Delete package error:", error);
    return { error: "Server connection error." };
  }
}

// --- Category Actions ---

export async function listCategoriesAction(packageId: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.get(`/api/packages/dashboard/${packageId}/categories`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to list categories." };
    }
    return await res.json() as any[];
  } catch (error) {
    console.error("List categories error:", error);
    return { error: "Server connection error." };
  }
}

export async function createCategoryAction(packageId: string, data: { title: string; slug: string; displayOrder?: number }) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post(`/api/packages/dashboard/${packageId}/categories`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to create category." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Create category error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateCategoryAction(packageId: string, id: string, data: { title: string; slug: string; displayOrder?: number }) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/packages/dashboard/categories/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update category." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Update category error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteCategoryAction(packageId: string, id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/packages/dashboard/categories/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete category." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Delete category error:", error);
    return { error: "Server connection error." };
  }
}

// --- Doc Actions ---

export async function listDocsAction(packageId: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.get(`/api/packages/dashboard/${packageId}/docs`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to list documentation pages." };
    }
    return await res.json() as any[];
  } catch (error) {
    console.error("List docs error:", error);
    return { error: "Server connection error." };
  }
}

export async function getDocAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.get(`/api/packages/dashboard/docs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to get documentation page details." };
    }
    return await res.json();
  } catch (error) {
    console.error("Get doc details error:", error);
    return { error: "Server connection error." };
  }
}

export async function createDocAction(
  packageId: string,
  data: {
    title: string;
    slug: string;
    categoryId?: string | null;
    description?: string | null;
    filePath?: string | null;
    content?: string;
    displayOrder?: number;
    isPublished?: boolean;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post(`/api/packages/dashboard/${packageId}/docs`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to create documentation page." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Create doc error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateDocAction(
  packageId: string,
  id: string,
  data: {
    title: string;
    slug: string;
    categoryId?: string | null;
    description?: string | null;
    filePath?: string | null;
    content?: string;
    displayOrder?: number;
    isPublished?: boolean;
  }
) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/packages/dashboard/docs/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update documentation page." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Update doc error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteDocAction(packageId: string, id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/packages/dashboard/docs/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete documentation page." };
    }
    revalidatePath(`/dashboard/packages/edit/${packageId}`);
    return { success: true };
  } catch (error) {
    console.error("Delete doc error:", error);
    return { error: "Server connection error." };
  }
}
