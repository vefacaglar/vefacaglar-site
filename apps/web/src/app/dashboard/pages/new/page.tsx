import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PageForm from "../../components/PageForm";

export default async function NewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  return <PageForm />;
}
