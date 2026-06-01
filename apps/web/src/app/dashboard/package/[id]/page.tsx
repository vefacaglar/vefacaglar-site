import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PackageItemForm from "../../packages/PackageItemForm";
import { getPackageItemAction, listPackageGroupsAction } from "../../packages/actions";

export const dynamic = "force-dynamic";

interface PackagePageProps {
  params: {
    id: string;
  };
}

export default async function PackagePage({ params }: PackagePageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  const [packageRes, groupsRes] = await Promise.all([
    getPackageItemAction(params.id),
    listPackageGroupsAction({ limit: 100 }),
  ]);

  const groups = groupsRes && "items" in groupsRes ? groupsRes.items : [];

  if (!packageRes || "error" in packageRes || groups.length === 0) {
    notFound();
  }

  return <PackageItemForm groups={groups} initialData={packageRes} />;
}
