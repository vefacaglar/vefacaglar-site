import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PackageForm from "../PackageForm";
import { requireAdmin } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export default async function NewPackagePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }
  await requireAdmin();

  return <PackageForm />;
}
