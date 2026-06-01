"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "../../../components/Button";
import styles from "../components/form.module.css";
import { createPackageItemAction, updatePackageItemAction } from "./actions";

interface PackageGroupOption {
  id: string;
  name: string;
}

interface PackageItemFormProps {
  groups: PackageGroupOption[];
  initialGroupId?: string;
  initialData?: {
    id: string;
    groupId: string;
    slug: string;
    name: string;
    description?: string | null;
    nugetUrl?: string | null;
    npmUrl?: string | null;
    githubUrl?: string | null;
    latestVersion: string;
    isActive: boolean;
  };
}

function slugify(text: string) {
  const trMap: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };
  let slugged = text;
  for (const key in trMap) {
    slugged = slugged.replace(new RegExp(key, "g"), trMap[key]);
  }
  return slugged
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export default function PackageItemForm({ groups, initialGroupId, initialData }: PackageItemFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");
  const defaultGroupId = initialData?.groupId || initialGroupId || groups[0]?.id || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [name, setName] = useState(initialData?.name || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [nugetUrl, setNugetUrl] = useState(initialData?.nugetUrl || "");
  const [npmUrl, setNpmUrl] = useState(initialData?.npmUrl || "");
  const [githubUrl, setGithubUrl] = useState(initialData?.githubUrl || "");
  const [latestVersion, setLatestVersion] = useState(initialData?.latestVersion || "1.0.0");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  useEffect(() => {
    if (!initialData) {
      setSlug(slugify(name));
    }
  }, [name, initialData]);

  const backHref = fromUrl || (groupId ? `/dashboard/package-groups/${groupId}` : "/dashboard/packages");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!groupId) {
      setError("Package group is required.");
      setLoading(false);
      return;
    }

    const payload = {
      groupId,
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      nugetUrl: nugetUrl.trim() || null,
      npmUrl: npmUrl.trim() || null,
      githubUrl: githubUrl.trim() || null,
      latestVersion: latestVersion.trim() || "1.0.0",
      isActive,
    };

    const result = initialData
      ? await updatePackageItemAction(initialData.groupId, initialData.id, payload)
      : await createPackageItemAction(groupId, payload);

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(backHref);
    router.refresh();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href={backHref} className="backLink">
          {fromUrl ? "← cancel" : "← back to package group"}
        </Link>
      </div>

      <h1>{initialData ? "edit package" : "add package"}</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className="errorMsg">{error}</div>}

        <div className="field">
          <label className="label">package group</label>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={styles.select} required>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">package name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="input" required />
        </div>

        <div className="field">
          <label className="label">slug</label>
          <input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} className="input" required />
        </div>

        <div className="field">
          <label className="label">description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="textarea" />
        </div>

        <div className="field">
          <label className="label">nuget url</label>
          <input value={nugetUrl} onChange={(event) => setNugetUrl(event.target.value)} className="input" />
        </div>

        <div className="field">
          <label className="label">npm url</label>
          <input value={npmUrl} onChange={(event) => setNpmUrl(event.target.value)} className="input" />
        </div>

        <div className="field">
          <label className="label">github url</label>
          <input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} className="input" />
        </div>

        <div className={styles.formRowAlignCenter}>
          <div className={`field ${styles.formCol}`}>
            <label className="label">latest version</label>
            <input value={latestVersion} onChange={(event) => setLatestVersion(event.target.value)} className="input" required />
          </div>

          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="packageItemActive"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="packageItemActive" className={`label ${styles.checkboxLabel}`}>
              active
            </label>
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : initialData ? "Save package" : "Create package"}
        </Button>
      </form>
    </div>
  );
}
