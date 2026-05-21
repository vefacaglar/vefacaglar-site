import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction, deletePostAction, deletePageAction } from "./actions";
import DeleteButton from "./components/DeleteButton";

const API_URL = process.env.API_URL || "http://localhost:3001";

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

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  // Fetch posts (including drafts)
  let posts: PostItem[] = [];
  try {
    const res = await fetch(`${API_URL}/api/posts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      posts = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch posts in admin:", error);
  }

  // Fetch pages (including drafts)
  let pages: PageItem[] = [];
  try {
    const res = await fetch(`${API_URL}/api/pages`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      pages = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch pages in admin:", error);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "48px" }}>
        <h1 style={{ margin: 0, fontSize: "20px" }}>Admin Panel</h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link
            href="/admin/profile"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "6px 12px",
              fontFamily: "inherit",
              borderRadius: "4px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Profile
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text)",
                padding: "6px 12px",
                fontFamily: "inherit",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Log Out
            </button>
          </form>
        </div>
      </div>

      {/* Posts Section */}
      <section style={{ marginBottom: "64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Posts (Blog Posts)</h2>
          <Link
            href="/admin/posts/new"
            style={{
              fontSize: "14px",
              color: "var(--accent)",
              textDecoration: "none",
              border: "1px solid var(--accent)",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            + New Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No posts added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
             <thead>
               <tr style={{ borderBottom: "1px solid var(--border)" }}>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal" }}>Title</th>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal" }}>Status</th>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal", textAlign: "right" }}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                  <td style={{ padding: "12px 0" }}>
                    <Link href={`/blog/${post.slug}`} target="_blank" style={{ textDecoration: "none" }}>
                      {post.title}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 0" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        background: post.status === "published" ? "rgba(76, 175, 80, 0.15)" : "rgba(255, 193, 7, 0.15)",
                        color: post.status === "published" ? "#4CAF50" : "#FFC107",
                      }}
                    >
                      {post.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 0", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end" }}>
                      <Link href={`/admin/posts/edit/${post.id}`} style={{ textDecoration: "underline", color: "var(--text)" }}>
                        Edit
                      </Link>
                      <DeleteButton id={post.id} type="post" title={post.title} onDelete={deletePostAction} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pages Section */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>Pages</h2>
          <Link
            href="/admin/pages/new"
            style={{
              fontSize: "14px",
              color: "var(--accent)",
              textDecoration: "none",
              border: "1px solid var(--accent)",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            + New Page
          </Link>
        </div>

        {pages.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No pages added yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
             <thead>
               <tr style={{ borderBottom: "1px solid var(--border)" }}>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal" }}>Title</th>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal" }}>Status</th>
                 <th style={{ padding: "8px 0", fontSize: "14px", color: "var(--muted)", fontWeight: "normal", textAlign: "right" }}>Actions</th>
               </tr>
             </thead>
             <tbody>
               {pages.map((page) => (
                <tr key={page.id} style={{ borderBottom: "1px solid var(--border)", fontSize: "14px" }}>
                  <td style={{ padding: "12px 0" }}>{page.title} (/{page.slug})</td>
                  <td style={{ padding: "12px 0" }}>
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        background: page.status === "published" ? "rgba(76, 175, 80, 0.15)" : "rgba(255, 193, 7, 0.15)",
                        color: page.status === "published" ? "#4CAF50" : "#FFC107",
                      }}
                    >
                      {page.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 0", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end" }}>
                      <Link href={`/admin/pages/edit/${page.id}`} style={{ textDecoration: "underline", color: "var(--text)" }}>
                        Edit
                      </Link>
                      <DeleteButton id={page.id} type="page" title={page.title} onDelete={deletePageAction} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
