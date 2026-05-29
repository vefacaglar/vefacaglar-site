import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DocForm from "../../../../DocForm";
import { listCategoriesAction } from "../../../../actions";

export const dynamic = "force-dynamic";

interface NewDocPageProps {
  params: {
    id: string;
  };
}

export default async function NewDocPage({ params }: NewDocPageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  let categories: any[] = [];
  try {
    const res = await listCategoriesAction(params.id);
    if (res && Array.isArray(res)) {
      categories = res;
    }
  } catch (error) {
    console.error("Failed to load categories in new doc page:", error);
  }

  return <DocForm packageId={params.id} categories={categories} />;
}
