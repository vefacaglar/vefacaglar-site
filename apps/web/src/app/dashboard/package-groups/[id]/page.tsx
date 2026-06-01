import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PackageForm from "../../packages/PackageForm";
import DocManagement from "../../packages/edit/[id]/DocManagement";
import PackageItemsManagement from "../../packages/edit/[id]/PackageItemsManagement";
import { getPackageGroupAction, listCategoriesAction, listDocsAction, listPackageItemsAction } from "../../packages/actions";

export const dynamic = "force-dynamic";

interface PackageGroupPageProps {
  params: {
    id: string;
  };
}

export default async function PackageGroupPage({ params }: PackageGroupPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let packageGroup = null;
  let packageItems: any[] = [];
  let categories: any[] = [];
  let docs: any[] = [];

  try {
    const [groupRes, packageItemsRes, categoriesRes, docsRes] = await Promise.all([
      getPackageGroupAction(params.id),
      listPackageItemsAction(params.id),
      listCategoriesAction(params.id),
      listDocsAction(params.id),
    ]);

    if (groupRes && !("error" in groupRes)) {
      packageGroup = groupRes;
    }
    if (packageItemsRes && Array.isArray(packageItemsRes)) {
      packageItems = packageItemsRes;
    }
    if (categoriesRes && Array.isArray(categoriesRes)) {
      categories = categoriesRes;
    }
    if (docsRes && Array.isArray(docsRes)) {
      docs = docsRes;
    }
  } catch (error) {
    console.error("Failed to fetch package group details:", error);
  }

  if (!packageGroup) {
    notFound();
  }

  return (
    <div>
      <PackageForm initialData={packageGroup} />
      <PackageItemsManagement groupId={params.id} packages={packageItems} />
      <DocManagement packageId={params.id} categories={categories} docs={docs} />
    </div>
  );
}
