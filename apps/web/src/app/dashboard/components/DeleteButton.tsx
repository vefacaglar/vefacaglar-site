"use client";

import React, { useState } from "react";
import styles from "./DeleteButton.module.css";
import ds from "../../../lib/dashboard-strings";
import { useConfirm } from "./ConfirmProvider";

interface DeleteButtonProps {
  id: string;
  type: "post" | "page" | "project" | "package";
  title: string;
  confirmMessage?: string;
  onDelete: (id: string) => Promise<{ error?: string; success?: boolean }>;
}

export default function DeleteButton({ id, type, title, confirmMessage, onDelete }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);
  const confirm = useConfirm();

  const handleDelete = async () => {
    const message = confirmMessage || ds.delete.confirm.replace("{type}", type).replace("{title}", title);
    if (!await confirm(message, { title: ds.games.modalTitle.edit.replace("{type}", ds.delete.button) })) return;

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
