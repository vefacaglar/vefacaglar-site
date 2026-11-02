import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import DocForm from "../../../../../packages/DocForm";
import { getDocAction, listCategoriesAction, getPackageGroupAction } from "../../../../../packages/actions";

export const dynamic = "force-dynamic";

interface EditDocPageProps {
  params: Promise<{
    id: string;
    docId: string;
  }>;
}

export default async function EditDocPage(props: EditDocPageProps) {
  const params = await props.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let categories: any[] = [];
  let docData = null;
  let groupSlug: string | undefined;

  try {
    const [categoriesRes, docRes, groupRes] = await Promise.all([
      listCategoriesAction(params.id),
      getDocAction(params.docId),
      getPackageGroupAction(params.id),
    ]);

    if (categoriesRes && Array.isArray(categoriesRes)) {
      categories = categoriesRes;
    }
    if (docRes && !("error" in docRes)) {
      docData = docRes;
    }
    if (groupRes && !("error" in groupRes)) {
      groupSlug = groupRes.slug;
    }
  } catch (error) {
    console.error("Failed to load edit doc page data:", error);
  }

  if (!docData) {
    notFound();
  }

  return <DocForm packageId={params.id} groupSlug={groupSlug} categories={categories} initialData={docData} />;
}
