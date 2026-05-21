"use client";

import styles from "./error.module.css";

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
      <button onClick={reset} className={styles.button}>
        Try again
      </button>
    </div>
  );
}