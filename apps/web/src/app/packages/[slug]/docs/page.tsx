import { notFound, redirect } from "next/navigation";
import { httpClient } from "../../../../lib/httpClient";

interface SidebarCategory {
  id: string;
  title: string;
  slug: string;
  displayOrder: number;
}

interface SidebarDoc {
  id: string;
  categoryId: string | null;
  slug: string;
  title: string;
  description: string | null;
  displayOrder: number;
}

interface PackageDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  nugetUrl: string | null;
  githubUrl: string | null;
  docs: string | null;
  latestVersion: string;
  content: string;
  categories: SidebarCategory[];
  docsList: SidebarDoc[];
}

export const dynamic = "force-dynamic";

export default async function PackageDocsPage({
  params,
}: {
  params: { slug: string };
}) {
  let pkg: PackageDetail | null = null;

  try {
    const res = await httpClient.get(`/api/packages/${params.slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      pkg = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch package details for docs routing:", error);
  }

  if (!pkg) {
    notFound();
  }

  // 1. If pkg.docs is set and is a valid slug (i.e. matches one of the docsList items), redirect there
  if (pkg.docs && !pkg.docs.startsWith("http") && !pkg.docs.includes("/")) {
    const hasDoc = pkg.docsList.some((doc) => doc.slug === pkg!.docs);
    if (hasDoc) {
      redirect(`/packages/${pkg.slug}/docs/${pkg.docs}`);
    }
  }

  // 2. Otherwise, find the first available published document (sorted by displayOrder)
  if (pkg.docsList.length > 0) {
    const sortedDocs = [...pkg.docsList].sort((a, b) => a.displayOrder - b.displayOrder);
    const firstDoc = sortedDocs[0];
    redirect(`/packages/${pkg.slug}/docs/${firstDoc.slug}`);
  }

  // 3. If no docs exist, fall back to the package detail overview page
  redirect(`/packages/${pkg.slug}`);
}
