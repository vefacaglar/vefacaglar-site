"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createDocAction, updateDocAction } from "./actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import styles from "../components/form.module.css";
import Button from "../../../components/Button";

interface CategoryItem {
  id: string;
  title: string;
}

interface DocFormProps {
  packageId: string;
  groupSlug?: string;
  categories: CategoryItem[];
  initialData?: {
    id: string;
    categoryId?: string | null;
    slug: string;
    title: string;
    description?: string | null;
    filePath?: string | null;
    content?: string;
    displayOrder: number;
    isPublished: boolean;
  };
}

export default function DocForm({ packageId, groupSlug, categories, initialData }: DocFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [filePath, setFilePath] = useState(initialData?.filePath || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [displayOrder, setDisplayOrder] = useState<number>(initialData?.displayOrder || 0);
  const [isPublished, setIsPublished] = useState<boolean>(initialData?.isPublished !== undefined ? initialData.isPublished : true);

  // Helper to slugify title
  const slugify = (text: string) => {
    const trMap: Record<string, string> = {
      'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i',
      'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
    };
    let slugged = text;
    for (const key in trMap) {
      slugged = slugged.replace(new RegExp(key, 'g'), trMap[key]);
    }
    return slugged
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  // Auto-generate slug from title ONLY when creating a new doc
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
      title: title.trim(),
      slug: slug.trim(),
      categoryId: categoryId || null,
      description: description.trim() || null,
      filePath: filePath.trim() || null,
      content: content.trim(),
      displayOrder: Number(displayOrder),
      isPublished,
    };

    let result;
    if (initialData) {
      result = await updateDocAction(packageId, initialData.id, payload, groupSlug);
    } else {
      result = await createDocAction(packageId, payload, groupSlug);
    }

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(fromUrl || `/dashboard/package-groups/${packageId}`);
      router.refresh();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href={fromUrl || `/dashboard/package-groups/${packageId}`} className="backLink">
          {fromUrl ? "← cancel" : "← back to package"}
        </Link>
      </div>

      <h1>
        {initialData ? "edit documentation page" : "add new documentation page"}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className="errorMsg">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label">page title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">slug (url path)</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">category (optional)</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={styles.select}
          >
            <option value="">None (Uncategorized)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">seo description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="textarea"
          />
        </div>

        <div className="field">
          <label className="label">markdown file path (physical path on server, optional)</label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="e.g. docs/package-name/getting-started.md"
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">MDX Content (Direct Database Content)</label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="# Page Title&#10;&#10;Write page content here in markdown/mdx format..."
          />
        </div>

        <div className={styles.formRowAlignCenter}>
          <div className={`field ${styles.formCol}`}>
            <label className="label">display order</label>
            <input
              type="number"
              required
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="input"
            />
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="isPublished"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="isPublished" className={`label ${styles.checkboxLabel}`}>
              published / visible in menu
            </label>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? "saving..." : initialData ? "save changes" : "create page"}
        </Button>
      </form>
    </div>
  );
}
