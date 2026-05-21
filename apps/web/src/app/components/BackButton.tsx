"use client";

import { useRouter } from "next/navigation";
import styles from "./BackButton.module.css";

interface BackButtonProps {
  label?: string;
}

export default function BackButton({ label = "← back" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={styles.backButton}
    >
      {label}
    </button>
  );
}