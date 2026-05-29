import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import DocForm from "../../../../../DocForm";
import { listCategoriesAction, getDocAction } from "../../../../../actions";

export const dynamic = "force-dynamic";

interface EditDocPageProps {
  params: {
    id: string;
    docId: string;
  };
}

export default async function EditDocPage({ params }: EditDocPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let categories: any[] = [];
  let docData = null;

  try {
    const [categoriesRes, docRes] = await Promise.all([
      listCategoriesAction(params.id),
      getDocAction(params.docId),
    ]);

    if (categoriesRes && Array.isArray(categoriesRes)) {
      categories = categoriesRes;
    }
    if (docRes && !("error" in docRes)) {
      docData = docRes;
    }
  } catch (error) {
    console.error("Failed to load edit doc page data:", error);
  }

  if (!docData) {
    notFound();
  }

  return <DocForm packageId={params.id} categories={categories} initialData={docData} />;
}
