import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PostForm from "../../components/PostForm";

export default async function NewPost() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/dashboard/login");
  }

  return <PostForm />;
}
