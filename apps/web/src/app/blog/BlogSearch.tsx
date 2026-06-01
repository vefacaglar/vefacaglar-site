"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./blog.module.css";

export default function BlogSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const query = initialQuery;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    startTransition(() => {
      router.replace(`/blog?q=${encodeURIComponent(value)}`);
    });
  }

  return (
    <form className={styles.searchForm} onSubmit={onSubmit}>
      <input
        className={styles.searchInput}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="search posts…"
        autoComplete="off"
      />
      {isPending && <span className={styles.noResults}>searching…</span>}
    </form>
  );
}
