import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PackageForm from "../../PackageForm";
import DocManagement from "./DocManagement";
import { httpClient } from "../../../../../lib/httpClient";
import { listCategoriesAction, listDocsAction } from "../../actions";

export const dynamic = "force-dynamic";

interface EditPackagePageProps {
  params: {
    id: string;
  };
}

export default async function EditPackagePage({ params }: EditPackagePageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let packageData = null;
  let categories: any[] = [];
  let docs: any[] = [];

  try {
    const res = await httpClient.get(`/api/packages/dashboard/${params.id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      packageData = await res.json();
    }

    const [categoriesRes, docsRes] = await Promise.all([
      listCategoriesAction(params.id),
      listDocsAction(params.id),
    ]);

    if (categoriesRes && Array.isArray(categoriesRes)) {
      categories = categoriesRes;
    }
    if (docsRes && Array.isArray(docsRes)) {
      docs = docsRes;
    }
  } catch (error) {
    console.error("Failed to fetch package details in edit page:", error);
  }

  if (!packageData) {
    notFound();
  }

  return (
    <div>
      <PackageForm initialData={packageData} />
      <DocManagement packageId={params.id} categories={categories} docs={docs} />
    </div>
  );
}
