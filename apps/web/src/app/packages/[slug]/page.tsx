import React from "react";
import { notFound } from "next/navigation";
import MarkdownPreview from "../../components/MarkdownPreview";
import { httpClient } from "../../../lib/httpClient";
import styles from "./packagePage.module.css";

interface PackageDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nugetUrl: string | null;
  npmUrl: string | null;
  githubUrl: string | null;
  docs: string | null;
  latestVersion: string;
  content: string;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const res = await httpClient.get(`/api/packages/${params.slug}`);
    if (!res.ok) return { title: "Package Not Found" };
    const pkg: PackageDetail = await res.json();
    return {
      title: `${pkg.name} | Package`,
      description: pkg.description || `Documentation and details for ${pkg.name}`,
    };
  } catch {
    return { title: "Package" };
  }
}

export default async function PackagePage({ params }: { params: { slug: string } }) {
  let pkg: PackageDetail | null = null;

  try {
    const res = await httpClient.get(`/api/packages/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      pkg = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch package details for page:", error);
  }

  if (!pkg) {
    notFound();
  }

  return (
    <div>
      <h1 className={styles.title}>
        {pkg.name}
      </h1>
      
      {pkg.description && (
        <p className={styles.description}>
          {pkg.description}
        </p>
      )}

      {pkg.content ? (
        <div className={styles.contentWrapper}>
          <MarkdownPreview content={pkg.content} />
        </div>
      ) : (
        <p className={styles.emptyText}>No overview available for this package.</p>
      )}
    </div>
  );
}
