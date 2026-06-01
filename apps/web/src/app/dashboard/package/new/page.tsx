import React from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import PackageItemForm from "../../packages/PackageItemForm";
import { listPackageGroupsAction } from "../../packages/actions";

export const dynamic = "force-dynamic";

interface NewPackagePageProps {
  searchParams: {
    groupId?: string;
  };
}

export default async function NewPackagePage({ searchParams }: NewPackagePageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  const groupsRes = await listPackageGroupsAction({ limit: 100 });
  const groups = groupsRes && "items" in groupsRes ? groupsRes.items : [];

  if (groups.length === 0) {
    notFound();
  }

  return <PackageItemForm groups={groups} initialGroupId={searchParams.groupId} />;
}
