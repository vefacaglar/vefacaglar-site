import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DocForm from "../../../../packages/DocForm";
import { listCategoriesAction, getPackageGroupAction } from "../../../../packages/actions";
import { requireAdmin } from "../../../../../../lib/session";

export const dynamic = "force-dynamic";

interface NewDocPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function NewDocPage(props: NewDocPageProps) {
  const params = await props.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }
  await requireAdmin();

  let categories: any[] = [];
  let groupSlug: string | undefined;
  try {
    const [categoriesRes, groupRes] = await Promise.all([
      listCategoriesAction(params.id),
      getPackageGroupAction(params.id),
    ]);
    if (categoriesRes && Array.isArray(categoriesRes)) {
      categories = categoriesRes;
    }
    if (groupRes && !("error" in groupRes)) {
      groupSlug = groupRes.slug;
    }
  } catch (error) {
    console.error("Failed to load categories or group slug in new doc page:", error);
  }

  return <DocForm packageId={params.id} groupSlug={groupSlug} categories={categories} />;
}
