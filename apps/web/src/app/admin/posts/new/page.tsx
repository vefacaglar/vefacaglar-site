import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PostForm from "../../components/PostForm";

export default function NewPost() {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/admin/login");
  }

  return <PostForm />;
}
