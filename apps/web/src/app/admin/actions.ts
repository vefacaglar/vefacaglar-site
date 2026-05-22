"use server";

import { cookies } from "next/headers";
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
    
    // Set cookie
    const cookieStore = cookies();
    cookieStore.set("session_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

  } catch (error) {
    console.error("Login action error:", error);
    return { error: "Server connection error." };
  }

  redirect("/admin");
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
  redirect("/admin/login");
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
    const res = await httpClient.delete(`/api/posts/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to delete post." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.delete(`/api/pages/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.message || "Failed to delete page." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.post("/api/posts", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create post." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.put(`/api/posts/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update post." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.post("/api/pages", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create page." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.put(`/api/pages/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update page." };
    }

    revalidatePath("/admin");
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

    revalidatePath("/admin/profile");
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
    const res = await httpClient.post("/api/projects", data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Could not create project." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.put(`/api/projects/${id}`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to update project." };
    }

    revalidatePath("/admin");
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
    const res = await httpClient.delete(`/api/projects/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.message || "Failed to delete project." };
    }

    revalidatePath("/admin");
    revalidatePath("/projects");
    return { success: true };
  } catch (error) {
    console.error("Delete project error:", error);
    return { error: "Server connection error." };
  }
}

