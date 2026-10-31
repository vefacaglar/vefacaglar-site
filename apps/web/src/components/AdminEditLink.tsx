import React from "react";
import Link from "next/link";
import { getSessionUser } from "../lib/session";
import { getActiveLanguage } from "../lib/lang";
import { getDictionary } from "../dictionaries";
import styles from "./AdminEditLink.module.css";

interface AdminEditLinkProps {
  type: "page" | "post" | "project";
  id: string;
  from?: string;
}

export default async function AdminEditLink({ type, id, from }: AdminEditLinkProps) {
  // Regular users can sign in too (e.g. to log games); only admins get edit links.
  const user = await getSessionUser();
  if (user?.role !== "admin") {
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
