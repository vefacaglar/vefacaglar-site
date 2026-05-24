"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createProjectAction, updateProjectAction } from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import LocalizationButton from "./LocalizationButton";
import styles from "./form.module.css";

interface ProjectFormProps {
  initialData?: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    content: string;
    status: "draft" | "published";
    featured: boolean;
    sortOrder: number;
    githubUrl?: string | null;
    liveUrl?: string | null;
    coverImageUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
  };
}

export default function ProjectForm({ initialData }: ProjectFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDateForInput = (dateString?: string | null) => {
    if (!dateString) return "";
    return dateString.split("T")[0];
  };

  // Form states
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [status, setStatus] = useState<"draft" | "published">(initialData?.status || "draft");
  const [featured, setFeatured] = useState<boolean>(initialData?.featured || false);
  const [sortOrder, setSortOrder] = useState<number>(initialData?.sortOrder || 0);
  const [githubUrl, setGithubUrl] = useState(initialData?.githubUrl || "");
  const [liveUrl, setLiveUrl] = useState(initialData?.liveUrl || "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.coverImageUrl || "");
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription || "");
  const [startedAt, setStartedAt] = useState(formatDateForInput(initialData?.startedAt));
  const [endedAt, setEndedAt] = useState(formatDateForInput(initialData?.endedAt));

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

  // Auto-generate slug from title ONLY when creating a new project
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
      summary,
      content,
      status,
      featured,
      sortOrder: Number(sortOrder),
      githubUrl: githubUrl || undefined,
      liveUrl: liveUrl || undefined,
      coverImageUrl: coverImageUrl || undefined,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      startedAt: startedAt || undefined,
      endedAt: endedAt || undefined,
    };

    let result;
    if (initialData) {
      result = await updateProjectAction(initialData.id, payload);
    } else {
      result = await createProjectAction(payload);
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
        {initialData ? "Edit Project" : "Add New Project"}
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
            <LocalizationButton
              entityType="project"
              entityId={initialData?.id}
              field="title"
              label="Title"
              initialValue={title}
            />
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
            <label className="label">Summary (Short Description)</label>
            <LocalizationButton
              entityType="project"
              entityId={initialData?.id}
              field="summary"
              label="Summary"
              initialValue={summary}
              inputType="textarea"
            />
          </div>
          <textarea
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="textarea"
          />
        </div>

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">Content (Markdown / MDX)</label>
            <LocalizationButton
              entityType="project"
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
            placeholder="# Project Details&#10;&#10;Write about features, challenges, and architecture in Markdown..."
            rows={15}
          />
        </div>

        <div className={styles.formRow}>
          <div className={`field ${styles.formCol}`}>
            <label className="label">Started At</label>
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="input"
            />
          </div>

          <div className={`field ${styles.formCol}`}>
            <label className="label">Ended At (Optional)</label>
            <input
              type="date"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className={styles.formRowAlignCenter}>
          <div className={`field ${styles.formCol}`}>
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

          <div className={`field ${styles.formCol}`}>
            <label className="label">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="input"
            />
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="featured"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="featured" className={`label ${styles.checkboxLabel}`}>
              Featured Project
            </label>
          </div>
        </div>

        <div className="field">
          <label className="label">GitHub Repo URL (Optional)</label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">Live Demo URL (Optional)</label>
          <input
            type="url"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="https://example.com"
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">Cover Image URL (Optional)</label>
          <input
            type="text"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            className="input"
          />
        </div>

        <details className={styles.seoDetails}>
          <summary className={styles.seoSummary}>SEO Settings (Optional)</summary>
          <div className={styles.seoFields}>
            <div className="field">
              <div className={styles.labelRow}>
                <label className={styles.seoLabel}>SEO Title</label>
                <LocalizationButton
                  entityType="project"
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
                  entityType="project"
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
          {loading ? "Saving..." : initialData ? "Save Changes" : "Publish Project"}
        </button>
      </form>
    </div>
  );
}
