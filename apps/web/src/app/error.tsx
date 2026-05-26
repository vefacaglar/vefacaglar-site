"use client";

import styles from "./error.module.css";
import Button from "../components/Button";
import { useLocale } from "../components/LocaleProvider";
import { getDictionary } from "../dictionaries";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const dict = getDictionary(locale);

  return (
    <div className={styles.container}>
      <h1>{dict.error_title}</h1>
      <p>{dict.error_message}</p>
      <Button onClick={reset} variant="ghost">
        {dict.error_retry}
      </Button>
    </div>
  );
}
