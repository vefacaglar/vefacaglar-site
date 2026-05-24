"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPageAction, updatePageAction } from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import LocalizationButton from "./LocalizationButton";
import styles from "./form.module.css";

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
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.push(fromUrl || "/dashboard");
      router.refresh();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href={fromUrl || "/dashboard"} className="backLink">
          {fromUrl ? "← cancel" : "← back to dashboard"}
        </Link>
      </div>

      <h1>
        {initialData ? "Edit Page" : "Add New Page"}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className="errorMsg">
            {error}
          </div>
        )}

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">Title</label>
            <LocalizationButton entityType="page" entityId={initialData?.id} field="title" label="Title" initialValue={title} />
          </div>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">Slug (URL Path)</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="input"
          />
        </div>

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">Content (Markdown / MDX)</label>
            <LocalizationButton
              entityType="page"
              entityId={initialData?.id}
              field="content"
              label="Content"
              initialValue={content}
              inputType="textarea"
            />
          </div>
          <MarkdownEditor
            required
            value={content}
            onChange={setContent}
            placeholder="# Page Title&#10;&#10;Write page content in MDX/Markdown format..."
            rows={15}
          />
        </div>

        <div className="field">
          <label className="label">Publish Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            className={styles.select}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <details className={styles.seoDetails}>
          <summary className={styles.seoSummary}>SEO Settings (Optional)</summary>
          <div className={styles.seoFields}>
            <div className="field">
              <div className={styles.labelRow}>
                <label className={styles.seoLabel}>SEO Title</label>
                <LocalizationButton
                  entityType="page"
                  entityId={initialData?.id}
                  field="seoTitle"
                  label="SEO Title"
                  initialValue={seoTitle}
                />
              </div>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className={styles.seoInput}
              />
            </div>
            <div className="field">
              <div className={styles.labelRow}>
                <label className={styles.seoLabel}>SEO Description</label>
                <LocalizationButton
                  entityType="page"
                  entityId={initialData?.id}
                  field="seoDescription"
                  label="SEO Description"
                  initialValue={seoDescription}
                  inputType="textarea"
                />
              </div>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={2}
                className={styles.seoInput}
              />
            </div>
          </div>
        </details>

        <button
          type="submit"
          disabled={loading}
          className={styles.submit}
        >
          {loading ? "Saving..." : initialData ? "Save Changes" : "Publish Page"}
        </button>
      </form>
    </div>
  );
}
