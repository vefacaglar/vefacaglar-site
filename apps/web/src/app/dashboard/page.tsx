import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction, deleteProjectAction } from "./actions";
import DashboardListsContainer from "./components/DashboardListsContainer";
import styles from "./dashboard.module.css";
import { httpClient } from "../../lib/httpClient";

interface PostItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

interface PageItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  createdAt: string;
}

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  // Fetch posts (including drafts)
  let posts: PostItem[] = [];
  try {
    const res = await httpClient.get("/api/posts/dashboard?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      posts = data.items || [];
    }
  } catch (error) {
    console.error("Failed to fetch posts in dashboard:", error);
  }

  // Fetch pages (including drafts)
  let pages: PageItem[] = [];
  try {
    const res = await httpClient.get("/api/pages/dashboard?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      pages = data.items || [];
    }
  } catch (error) {
    console.error("Failed to fetch pages in dashboard:", error);
  }

  // Fetch projects (including drafts)
  let projects: ProjectItem[] = [];
  try {
    const res = await httpClient.get("/api/projects/dashboard?limit=1000", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      projects = data.items || [];
    }
  } catch (error) {
    console.error("Failed to fetch projects in dashboard:", error);
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.actions}>
          <Link href="/dashboard/profile" className="btnGhost">
            Profile
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btnGhost">
              Log Out
            </button>
          </form>
        </div>
      </div>

      <div className={styles.tabsContainer}>
        <Link href="/dashboard" className={`${styles.tab} ${styles.activeTab}`}>
          Content
        </Link>
        <Link href="/dashboard/games" className={styles.tab}>
          Games
        </Link>
      </div>

      <DashboardListsContainer
        initialPosts={posts}
        initialProjects={projects}
        initialPages={pages}
        deletePostAction={deletePostAction}
        deleteProjectAction={deleteProjectAction}
        deletePageAction={deletePageAction}
      />
    </div>
  );
}
