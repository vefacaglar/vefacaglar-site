"use client";

import React, { useState } from "react";

interface DeleteButtonProps {
  id: string;
  type: "post" | "page";
  title: string;
  onDelete: (id: string) => Promise<{ error?: string; success?: boolean }>;
}

export default function DeleteButton({ id, type, title, onDelete }: DeleteButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const message = `Are you sure you want to delete the ${type === "post" ? "post" : "page"} "${title}"?`;
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
      style={{
        background: "transparent",
        color: "var(--accent)",
        border: "none",
        fontFamily: "inherit",
        textDecoration: "underline",
        cursor: loading ? "not-allowed" : "pointer",
        fontSize: "14px",
        padding: 0,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
