"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPageAction, deleteLocalizationAction, updatePageAction } from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import LocalizationButton from "./LocalizationButton";
import { formatEntityRemoveFeedback } from "./LocalizationButton.helpers";
import { useConfirm } from "./ConfirmProvider";
import styles from "./form.module.css";
import pageStyles from "./PageForm.module.css";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";
import { safeInternalPath } from "../../../lib/safePath";

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
  const fromUrl = safeInternalPath(searchParams.get("from"));
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [removingTranslation, setRemovingTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleRemoveTurkishTranslation = async () => {
    if (!initialData?.id) return;
    const confirmed = await confirm(
      ds.localization.removeAllConfirm.replace("{title}", title || initialData.title),
      {
        title: ds.localization.removeAllModalTitle,
        confirmText: ds.localization.removeAllConfirmButton,
        cancelText: ds.localization.cancel,
      }
    );
    if (!confirmed) return;

    setRemovingTranslation(true);
    setError(null);
    setSuccessMessage(null);

    const result = await deleteLocalizationAction({
      entityType: "page",
      entityId: initialData.id,
      languageCode: "tr",
    });

    if (result.error) {
      setError(result.error);
      setRemovingTranslation(false);
      return;
    }

    setSuccessMessage(
      formatEntityRemoveFeedback(result.data?.deletedCount, {
        removedAll: ds.localization.removedAll,
        nothingToRemove: ds.localization.nothingToRemove,
      })
    );
    setRemovingTranslation(false);
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

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
          {fromUrl ? ds.forms.backCancel : ds.forms.backToDashboard}
        </Link>
      </div>

      <div className={pageStyles.headerRow}>
        <h1 className={pageStyles.heading}>
          {initialData ? ds.forms.editPage : ds.forms.addNewPage}
        </h1>
        {initialData?.id && (
          <Button
            type="button"
            variant="ghost"
            className={pageStyles.removeTranslationBtn}
            disabled={loading || removingTranslation}
            onClick={handleRemoveTurkishTranslation}
          >
            {removingTranslation ? ds.localization.removingAll : ds.localization.removeAll}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className="errorMsg">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="successMsg">
            {successMessage}
          </div>
        )}

        <div className="field">
          <div className={styles.labelRow}>
            <label className="label">{ds.forms.title}</label>
            <LocalizationButton entityType="page" entityId={initialData?.id} field="title" label={ds.forms.title} initialValue={title} />
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
            <label className="label">{ds.forms.content}</label>
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
            placeholder={ds.forms.placeholders.mdxPage}
            rows={15}
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
                  entityType="page"
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
                  entityType="page"
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
          disabled={loading || removingTranslation}
          className={styles.submitBtn}
        >
          {loading ? ds.forms.saving : initialData ? ds.forms.saveChanges : ds.forms.publishPage}
        </Button>
      </form>
    </div>
  );
}
