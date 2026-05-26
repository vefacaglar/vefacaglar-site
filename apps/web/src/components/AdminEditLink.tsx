import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getActiveLanguage } from "../lib/lang";
import { getDictionary } from "../dictionaries";
import styles from "./AdminEditLink.module.css";

interface AdminEditLinkProps {
  type: "page" | "post" | "project";
  id: string;
  from?: string;
}

export default function AdminEditLink({ type, id, from }: AdminEditLinkProps) {
  const cookieStore = cookies();
  const token = cookieStore.get("session_token")?.value;

  // Only render if session_token is present
  if (!token) {
    return null;
  }

  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  let href = "";
  let label = "";
  const queryParam = from ? `?from=${encodeURIComponent(from)}` : "";

  if (type === "page") {
    href = `/dashboard/pages/edit/${id}${queryParam}`;
    label = dict.edit_page;
  } else if (type === "post") {
    href = `/dashboard/posts/edit/${id}${queryParam}`;
    label = dict.edit_post;
  } else if (type === "project") {
    href = `/dashboard/projects/edit/${id}${queryParam}`;
    label = dict.edit_project;
  }

  return (
    <div className={styles.container}>
      <Link href={href} className={styles.editButton}>
        <span className={styles.icon}>✎</span>
        {label}
      </Link>
    </div>
  );
}
