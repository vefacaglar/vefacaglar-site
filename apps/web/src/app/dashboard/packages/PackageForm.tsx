"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createPackageAction, updatePackageAction } from "./actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import styles from "../components/form.module.css";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";

interface PackageFormProps {
  initialData?: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    nugetUrl?: string | null;
    githubUrl?: string | null;
    latestVersion: string;
    isActive: boolean;
    content?: string;
    docs?: string | null;
  };
}

export default function PackageForm({ initialData }: PackageFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(initialData?.name || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [nugetUrl, setNugetUrl] = useState(initialData?.nugetUrl || "");
  const [githubUrl, setGithubUrl] = useState(initialData?.githubUrl || "");
  const [docsUrl, setDocsUrl] = useState(initialData?.docs || "");
  const [latestVersion, setLatestVersion] = useState(initialData?.latestVersion || "1.0.0");
  const [isActive, setIsActive] = useState<boolean>(initialData?.isActive !== undefined ? initialData.isActive : true);

  // Helper to slugify name
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
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  };

  // Auto-generate slug from name ONLY when creating a new package
  useEffect(() => {
    if (!initialData) {
      setSlug(slugify(name));
    }
  }, [name, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      nugetUrl: nugetUrl.trim() || undefined,
      githubUrl: githubUrl.trim() || undefined,
      docs: docsUrl.trim() || undefined,
      latestVersion: latestVersion.trim() || "1.0.0",
      isActive,
      content: content.trim(),
    };

    let result;
    if (initialData) {
      result = await updatePackageAction(initialData.id, payload);
    } else {
      result = await createPackageAction(payload);
    }

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(fromUrl || "/dashboard/packages");
      router.refresh();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href={fromUrl || "/dashboard/packages"} className="backLink">
          {fromUrl ? ds.forms.backCancel : "← back to packages"}
        </Link>
      </div>

      <h1>
        {initialData ? ds.packages.editPackage : ds.packages.addNewPackage}
      </h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className="errorMsg">
            {error}
          </div>
        )}

        <div className="field">
          <label className="label">{ds.packages.name}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">{ds.packages.slug}</label>
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">{ds.packages.description}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="textarea"
          />
        </div>

        <div className="field">
          <label className="label">{ds.forms.content}</label>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder={ds.forms.placeholders.mdxProject}
          />
        </div>

        <div className="field">
          <label className="label">{ds.packages.nugetUrl}</label>
          <input
            type="url"
            value={nugetUrl}
            onChange={(e) => setNugetUrl(e.target.value)}
            placeholder="https://www.nuget.org/packages/..."
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">{ds.packages.githubUrl}</label>
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="input"
          />
        </div>

        <div className="field">
          <label className="label">Default Docs Page Slug (optional)</label>
          <input
            type="text"
            value={docsUrl}
            onChange={(e) => setDocsUrl(e.target.value)}
            placeholder="e.g. quickstart"
            className="input"
          />
        </div>

        <div className={styles.formRowAlignCenter}>
          <div className={`field ${styles.formCol}`}>
            <label className="label">{ds.packages.latestVersion}</label>
            <input
              type="text"
              required
              value={latestVersion}
              onChange={(e) => setLatestVersion(e.target.value)}
              className="input"
            />
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="isActive" className={`label ${styles.checkboxLabel}`}>
              {ds.packages.isActive}
            </label>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? ds.packages.saving : initialData ? ds.packages.saveChanges : ds.packages.publishPackage}
        </Button>
      </form>
    </div>
  );
}
