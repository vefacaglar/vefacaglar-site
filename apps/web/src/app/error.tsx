"use client";

import styles from "./error.module.css";
import Button from "../components/Button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.container}>
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred.</p>
      <Button onClick={reset} variant="ghost">
        Try again
      </Button>
    </div>
  );
}