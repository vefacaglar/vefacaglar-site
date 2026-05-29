"use client";

import React, { useState } from "react";
import styles from "./DeleteButton.module.css";
import ds from "../../../lib/dashboard-strings";

interface DeleteButtonProps {
  id: string;
  type: "post" | "page" | "project" | "package";
  title: string;
  onDelete: (id: string) => Promise<{ error?: string; success?: boolean }>;
}

export default function DeleteButton({ id, type, title, onDelete }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const message = ds.delete.confirm.replace("{type}", type).replace("{title}", title);
    if (!window.confirm(message)) return;

    setLoading(true);
    const result = await onDelete(id);
    if (result && result.error) {
      alert(result.error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className={styles.delete}
    >
      {loading ? ds.delete.deleting : ds.delete.button}
    </button>
  );
}
