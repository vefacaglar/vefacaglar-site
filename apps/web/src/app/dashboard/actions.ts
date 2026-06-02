"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { httpClient } from "../../lib/httpClient";
import { authedRequest, authedMutation } from "../../lib/apiAction";
import { revalidateBlogPages, revalidateProjectPages, revalidatePagePages } from "../../lib/revalidator";

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Please fill in all fields." };
  }

  try {
    const res = await httpClient.post("/api/auth/login", { email, password });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Login failed. Please check your credentials." };
    }

    const data = await res.json();

    const headersList = headers();
    const proto = headersList.get("x-forwarded-proto");
    const isSecure = proto === "https" || process.env.NODE_ENV === "production";

    const cookieStore = cookies();
    cookieStore.set("session_token", data.token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

  } catch (error) {
    console.error("Login action error:", error);
    return { error: "Server connection error." };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (token) {
    try {
      // Best effort API logout
      await httpClient.post("/api/auth/logout", undefined, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      console.error("API logout failed:", e);
    }
  }

  cookieStore.delete("session_token");
  redirect("/dashboard/login");
}

export async function getSessionToken() {
  const cookieStore = cookies();
  return cookieStore.get("session_token")?.value || null;
}

export async function deletePostAction(id: string) {
  const result = await authedMutation("DELETE", `/api/posts/dashboard/${id}`, {
    fallbackError: "Failed to delete post.",
  });
  if (result.success) {
    await revalidateBlogPages();
  }
  return result;
}

export async function deletePageAction(id: string) {
  const result = await authedMutation("DELETE", `/api/pages/dashboard/${id}`, {
    fallbackError: "Failed to delete page.",
  });
  if (result.success) {
    await revalidatePagePages();
  }
  return result;
}

export async function createPostAction(data: {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: "draft" | "published";
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
}) {
  const result = await authedMutation("POST", "/api/posts/dashboard", {
    body: data,
    fallbackError: "Could not create post.",
  });
  if (result.success) {
    await revalidateBlogPages();
  }
  return result;
}

export async function updatePostAction(
  id: string,
  data: {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    status: "draft" | "published";
    coverImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
  }
) {
  const result = await authedMutation("PUT", `/api/posts/dashboard/${id}`, {
    body: data,
    fallbackError: "Failed to update post.",
  });
  if (result.success) {
    await revalidateBlogPages(data.slug);
  }
  return result;
}

export async function createPageAction(data: {
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  seoTitle?: string;
  seoDescription?: string;
}) {
  const result = await authedMutation("POST", "/api/pages/dashboard", {
    body: data,
    fallbackError: "Could not create page.",
  });
  if (result.success) {
    await revalidatePagePages();
  }
  return result;
}

export async function updatePageAction(
  id: string,
  data: {
    title: string;
    slug: string;
    content: string;
    status: "draft" | "published";
    seoTitle?: string;
    seoDescription?: string;
  }
) {
  const result = await authedMutation("PUT", `/api/pages/dashboard/${id}`, {
    body: data,
    fallbackError: "Failed to update page.",
  });
  if (result.success) {
    await revalidatePagePages(data.slug);
  }
  return result;
}

export async function getProfileAction() {
  return authedRequest("GET", "/api/auth/profile", {
    fallbackError: "Failed to fetch profile.",
  });
}

export async function updateProfileAction(data: {
  email: string;
  username: string;
  displayName: string;
}) {
  return authedMutation("PUT", "/api/auth/profile", {
    body: data,
    revalidate: ["/dashboard/profile"],
    fallbackError: "Failed to update profile.",
  });
}

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
}) {
  return authedMutation("PUT", "/api/auth/profile/password", {
    body: data,
    fallbackError: "Failed to change password.",
  });
}

export async function createProjectAction(data: {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: "draft" | "published";
  featured?: boolean;
  sortOrder?: number;
  githubUrl?: string;
  liveUrl?: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  startedAt?: string;
  endedAt?: string;
}) {
  const result = await authedMutation("POST", "/api/projects/dashboard", {
    body: data,
    fallbackError: "Could not create project.",
  });
  if (result.success) {
    await revalidateProjectPages();
  }
  return result;
}

export async function updateProjectAction(
  id: string,
  data: {
    title: string;
    slug: string;
    summary: string;
    content: string;
    status: "draft" | "published";
    featured?: boolean;
    sortOrder?: number;
    githubUrl?: string;
    liveUrl?: string;
    coverImageUrl?: string;
    seoTitle?: string;
    seoDescription?: string;
    startedAt?: string;
    endedAt?: string;
  }
) {
  const result = await authedMutation("PUT", `/api/projects/dashboard/${id}`, {
    body: data,
    fallbackError: "Failed to update project.",
  });
  if (result.success) {
    await revalidateProjectPages(data.slug);
  }
  return result;
}

export async function deleteProjectAction(id: string) {
  const result = await authedMutation("DELETE", `/api/projects/dashboard/${id}`, {
    fallbackError: "Failed to delete project.",
  });
  if (result.success) {
    await revalidateProjectPages();
  }
  return result;
}

export async function uploadImageAction(formData: FormData) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  const API_URL = process.env.API_URL;

  if (!API_URL) {
    return { error: "API_URL environment variable is not set." };
  }

  try {
    const res = await fetch(`${API_URL}/api/uploads/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to upload image." };
    }

    return await res.json();
  } catch (error) {
    console.error(`Upload image error (tried fetching from ${API_URL}/api/uploads/image):`, error);
    return { error: `Server connection error (tried connecting to ${API_URL}).` };
  }
}

export async function upsertLocalizationAction(data: {
  entityType: "page" | "post" | "project";
  entityId: string;
  languageCode: "tr";
  field: string;
  value: string;
}): Promise<{ error?: string; success?: true; data?: any }> {
  const res = await authedRequest("POST", "/api/localizations", {
    body: data,
    revalidate: [],
    fallbackError: "Failed to save localization.",
  });
  if ("error" in res) return { error: res.error };
  await revalidatePagePages();
  await revalidateBlogPages();
  await revalidateProjectPages();
  return { success: true, data: res.data };
}

export async function getLocalizationAction(data: {
  entityType: "page" | "post" | "project";
  entityId: string;
  languageCode: "tr";
  field: string;
}): Promise<{ error?: string; data?: any }> {
  const params = new URLSearchParams({
    entityType: data.entityType,
    entityId: data.entityId,
    languageCode: data.languageCode,
    field: data.field,
  });

  const res = await authedRequest("GET", `/api/localizations?${params.toString()}`, {
    fallbackError: "Failed to load localization.",
  });
  if ("error" in res) return { error: res.error };
  return { data: res.data };
}
