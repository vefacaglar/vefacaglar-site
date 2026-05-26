"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary } from "../../dictionaries";
import styles from "./BackButton.module.css";

interface BackButtonProps {
  label?: string;
}

export default function BackButton({ label }: BackButtonProps) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);

  return (
    <button
      onClick={() => router.back()}
      className={styles.backButton}
    >
      {label || dict.back_button}
    </button>
  );
}
