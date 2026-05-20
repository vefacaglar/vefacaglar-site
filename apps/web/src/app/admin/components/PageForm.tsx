"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPageAction, updatePageAction } from "../actions";

interface PageFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    content: string;
    status: "draft" | "published";
    seoTitle?: string | null;
    seoDescription?: string | null;
  };
}

export default function PageForm({ initialData }: PageFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Form states
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [status, setStatus] = useState<"draft" | "published">(initialData?.status || "draft");
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription || "");

  // Helper to slugify title
  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  };

  // Auto-generate slug from title ONLY when creating a new page
  useEffect(() => {
    if (!initialData) {
      setSlug(slugify(title));
    }
  }, [title, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title,
      slug,
      content,
      status,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
    };

    let result;
    if (initialData) {
      result = await updatePageAction(initialData.id, payload);
    } else {
      result = await createPageAction(payload);
    }

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <Link href="/admin" style={{ color: "var(--muted)", textDecoration: "none" }}>← admin paneline dön</Link>
      </div>

      <h1 style={{ marginBottom: "32px" }}>
        {initialData ? "Sayfayı Düzenle" : "Yeni Sayfa Ekle"}
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {error && (
          <div style={{ color: "var(--accent)", padding: "12px", border: "1px solid var(--accent)", borderRadius: "4px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "var(--muted)" }}>Başlık</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "10px",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "inherit",
              borderRadius: "4px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "var(--muted)" }}>Slug (URL Yolu)</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            style={{
              padding: "10px",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "inherit",
              borderRadius: "4px",
              outline: "none",
            }}
          />
        </div>

        {/* Markdown Content Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontSize: "14px", color: "var(--muted)" }}>İçerik (Markdown / MDX)</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontFamily: "inherit",
                  color: activeTab === "edit" ? "var(--text-heading)" : "var(--muted)",
                  fontWeight: activeTab === "edit" ? "bold" : "normal",
                  textDecoration: activeTab === "edit" ? "underline" : "none",
                  cursor: "pointer",
                }}
              >
                Yaz
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontFamily: "inherit",
                  color: activeTab === "preview" ? "var(--text-heading)" : "var(--muted)",
                  fontWeight: activeTab === "preview" ? "bold" : "normal",
                  textDecoration: activeTab === "preview" ? "underline" : "none",
                  cursor: "pointer",
                }}
              >
                Önizleme
              </button>
            </div>
          </div>

          {activeTab === "edit" ? (
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              placeholder="# Sayfa Başlığı&#10;&#10;MDX/Markdown formatında sayfa içeriğini yazın..."
              style={{
                padding: "10px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontFamily: "inherit",
                borderRadius: "4px",
                outline: "none",
                resize: "vertical",
                lineHeight: "1.5",
              }}
            />
          ) : (
            <div
              style={{
                minHeight: "330px",
                padding: "12px",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: "14px",
                background: "var(--bg)",
                overflowY: "auto",
              }}
            >
              {content ? (
                <div style={{ opacity: 0.9 }}>
                  {/* Basic local markdown rendering for quick preview */}
                  {content.split("\n").map((line, index) => {
                    if (line.startsWith("# ")) {
                      return <h1 key={index} style={{ margin: "16px 0 8px 0" }}>{line.replace("# ", "")}</h1>;
                    }
                    if (line.startsWith("## ")) {
                      return <h2 key={index} style={{ margin: "16px 0 8px 0" }}>{line.replace("## ", "")}</h2>;
                    }
                    if (line.startsWith("- ") || line.startsWith("* ")) {
                      return <li key={index}>{line.substring(2)}</li>;
                    }
                    return <p key={index} style={{ margin: "0 0 8px 0" }}>{line}</p>;
                  })}
                </div>
              ) : (
                <span style={{ color: "var(--muted)" }}>Henüz içerik yazılmamış.</span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", color: "var(--muted)" }}>Yayın Durumu</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            style={{
              padding: "10px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "inherit",
              borderRadius: "4px",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="draft">Taslak (Draft)</option>
            <option value="published">Yayında (Published)</option>
          </select>
        </div>

        {/* SEO Collapsible Section */}
        <details style={{ border: "1px solid var(--border)", borderRadius: "4px", padding: "12px" }}>
          <summary style={{ cursor: "pointer", fontSize: "14px", color: "var(--muted)" }}>SEO Ayarları (Opsiyonel)</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", color: "var(--muted)" }}>SEO Başlığı</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  borderRadius: "4px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "12px", color: "var(--muted)" }}>SEO Açıklaması</label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                style={{
                  padding: "8px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  borderRadius: "4px",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "14px",
            background: "var(--text-heading)",
            color: "var(--bg)",
            border: "none",
            fontFamily: "inherit",
            fontWeight: "bold",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s",
            marginTop: "16px",
          }}
        >
          {loading ? "Kaydediliyor..." : initialData ? "Değişiklikleri Kaydet" : "Sayfayı Yayınla"}
        </button>
      </form>
    </div>
  );
}
