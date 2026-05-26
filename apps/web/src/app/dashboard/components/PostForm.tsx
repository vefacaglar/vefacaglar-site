"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPostAction, updatePostAction } from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import LocalizationButton from "./LocalizationButton";
import styles from "./form.module.css";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";

interface PostFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    content: string;
    status: "draft" | "published";
    coverImageUrl?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
  };
}

export default function PostForm({ initialData }: PostFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [status, setStatus] = useState<"draft" | "published">(initialData?.status || "draft");
  const [coverImageUrl, setCoverImageUrl] = useState(initialData?.coverImageUrl || "");
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

  // Auto-generate slug from title ONLY when creating a new post (no initialData)
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
      excerpt: excerpt || undefined,
      content,
      status,
      coverImageUrl: coverImageUrl || undefined,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
    };

    let result;
    if (initialData) {
      result = await updatePostAction(initialData.id, payload);
    } else {
      result = await createPostAction(payload);
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
          {fromUrl ? ds.forms.backCancel : ds.forms.backToDashboard}
        </Link>
      </div>

      <h1>
        {initialData ? ds.forms.editPost : ds.forms.addNewPost}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className="errorMsg">
            {error}
          </div>
        )}

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">{ds.forms.title}</label>
            <LocalizationButton entityType="post" entityId={initialData?.id} field="title" label={ds.forms.title} initialValue={title} />
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
          <label className="label">{ds.forms.slug}</label>
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
            <label className="label">{ds.forms.excerpt}</label>
            <LocalizationButton
              entityType="post"
              entityId={initialData?.id}
              field="excerpt"
              label={ds.forms.excerpt}
              initialValue={excerpt}
              inputType="textarea"
            />
          </div>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="textarea"
          />
        </div>

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">{ds.forms.content}</label>
            <LocalizationButton
              entityType="post"
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
            placeholder={ds.forms.placeholders.mdxPost}
            rows={15}
          />
        </div>

        <div className="field">
          <label className="label">{ds.forms.coverImageUrl}</label>
          <input
            type="text"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder={ds.forms.placeholders.coverImageUrl}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">{ds.forms.publishStatus}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            className={styles.select}
          >
            <option value="draft">{ds.content.status.draft}</option>
            <option value="published">{ds.content.status.published}</option>
          </select>
        </div>

        <details className={styles.seoDetails}>
          <summary className={styles.seoSummary}>{ds.forms.seoSettings}</summary>
          <div className={styles.seoFields}>
            <div className="field">
              <div className={styles.labelRow}>
                <label className={styles.seoLabel}>{ds.forms.seoTitle}</label>
                <LocalizationButton
                  entityType="post"
                  entityId={initialData?.id}
                  field="seoTitle"
                  label={ds.forms.seoTitle}
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
                <label className={styles.seoLabel}>{ds.forms.seoDescription}</label>
                <LocalizationButton
                  entityType="post"
                  entityId={initialData?.id}
                  field="seoDescription"
                  label={ds.forms.seoDescription}
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

        <Button
          type="submit"
          disabled={loading}
          className={styles.submitBtn}
        >
          {loading ? ds.forms.saving : initialData ? ds.forms.saveChanges : ds.forms.publishPost}
        </Button>
      </form>
    </div>
  );
}
