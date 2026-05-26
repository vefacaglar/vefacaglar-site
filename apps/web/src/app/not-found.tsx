import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary } from "../dictionaries";
import styles from "./not-found.module.css";

export default function NotFound() {
  let lang = "en";
  try {
    const localeHeader = headers().get("x-locale");
    if (localeHeader === "tr") {
      lang = "tr";
    }
  } catch (e) {
  }

  const dict = getDictionary(lang);

  return (
    <div className={styles.container}>
      <h1>{dict.not_found_title}</h1>
      <p>{dict.page_not_found}</p>
      <Link href={lang === "tr" ? "/tr" : "/"} className={styles.link}>
        {dict.go_home}
      </Link>
    </div>
  );
}
