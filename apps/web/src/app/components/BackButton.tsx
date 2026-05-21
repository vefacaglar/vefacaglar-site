"use client";

import { useRouter } from "next/navigation";

interface BackButtonProps {
  label?: string;
  style?: React.CSSProperties;
}

export default function BackButton({ label = "← back", style }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        color: "var(--muted)",
        textDecoration: "none",
        fontSize: "inherit",
        ...style,
      }}
    >
      {label}
    </button>
  );
}