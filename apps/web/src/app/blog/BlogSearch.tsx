"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "../../components/LocaleProvider";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./blog.module.css";

export default function BlogSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const query = initialQuery;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (form.elements.namedItem("q") as HTMLInputElement).value.trim();
    const base = localizeHref("/blog", locale);
    startTransition(() => {
      router.replace(value ? `${base}?q=${encodeURIComponent(value)}` : base);
    });
  }

  return (
    <form className={styles.searchForm} onSubmit={onSubmit}>
      <input
        className={styles.searchInput}
        type="search"
        name="q"
        defaultValue={query}
        placeholder={dict.blog_search_placeholder}
        autoComplete="off"
      />
    </form>
  );
}
