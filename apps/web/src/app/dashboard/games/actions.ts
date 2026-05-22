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
