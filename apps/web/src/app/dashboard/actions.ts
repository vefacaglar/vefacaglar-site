"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { httpClient } from "../../lib/httpClient";

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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/posts/dashboard/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to delete post." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/blog");
    return { success: true };
  } catch (error) {
    console.error("Delete post error:", error);
    return { error: "Server connection error." };
  }
}

export async function deletePageAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/pages/dashboard/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to delete page." };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Delete page error:", error);
    return { error: "Server connection error." };
  }
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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/posts/dashboard", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create post." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/blog");
    return { success: true };
  } catch (error) {
    console.error("Create post error:", error);
    return { error: "Server connection error." };
  }
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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/posts/dashboard/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update post." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/blog");
    revalidatePath(`/blog/${data.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Update post error:", error);
    return { error: "Server connection error." };
  }
}

export async function createPageAction(data: {
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  seoTitle?: string;
  seoDescription?: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/pages/dashboard", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create page." };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Create page error:", error);
    return { error: "Server connection error." };
  }
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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/pages/dashboard/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update page." };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Update page error:", error);
    return { error: "Server connection error." };
  }
}

export async function getProfileAction() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.get("/api/auth/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to fetch profile." };
    }

    return { data: await res.json() };
  } catch (error) {
    console.error("Get profile error:", error);
    return { error: "Server connection error." };
  }
}

export async function updateProfileAction(data: {
  email: string;
  username: string;
  displayName: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put("/api/auth/profile", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update profile." };
    }

    revalidatePath("/dashboard/profile");
    return { success: true };
  } catch (error) {
    console.error("Update profile error:", error);
    return { error: "Server connection error." };
  }
}

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put("/api/auth/profile/password", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to change password." };
    }

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { error: "Server connection error." };
  }
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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/projects/dashboard", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create project." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("Create project error:", error);
    return { error: "Server connection error." };
  }
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
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.put(`/api/projects/dashboard/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update project." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${data.slug}`);
    return { success: true };
  } catch (error) {
    console.error("Update project error:", error);
    return { error: "Server connection error." };
  }
}

export async function deleteProjectAction(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.delete(`/api/projects/dashboard/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete project." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("Delete project error:", error);
    return { error: "Server connection error." };
  }
}

export async function uploadImageAction(formData: FormData) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const API_URL = process.env.API_URL || "http://localhost:3001";
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
    console.error("Upload image error:", error);
    return { error: "Server connection error." };
  }
}

export async function upsertLocalizationAction(data: {
  entityType: "page" | "post" | "project";
  entityId: string;
  languageCode: "tr";
  field: string;
  value: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  try {
    const res = await httpClient.post("/api/localizations", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to save localization." };
    }

    return { success: true, data: await res.json() };
  } catch (error) {
    console.error("Upsert localization error:", error);
    return { error: "Server connection error." };
  }
}

export async function getLocalizationAction(data: {
  entityType: "page" | "post" | "project";
  entityId: string;
  languageCode: "tr";
  field: string;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) return { error: "Unauthorized." };

  const params = new URLSearchParams({
    entityType: data.entityType,
    entityId: data.entityId,
    languageCode: data.languageCode,
    field: data.field,
  });

  try {
    const res = await httpClient.get(`/api/localizations?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to load localization." };
    }

    return { data: await res.json() };
  } catch (error) {
    console.error("Get localization error:", error);
    return { error: "Server connection error." };
  }
}
