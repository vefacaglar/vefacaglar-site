import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProjectForm from "../../components/ProjectForm";

export default function NewProject() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  return <ProjectForm />;
}
