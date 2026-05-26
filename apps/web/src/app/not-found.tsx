import Link from "next/link";
import { headers } from "next/headers";
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

  const isTr = lang === "tr";

  return (
    <div className={styles.container}>
      <h1>404</h1>
      <p>{isTr ? "sayfa bulunamadı." : "page not found."}</p>
      <Link href={isTr ? "/tr" : "/"} className={styles.link}>
        {isTr ? "ana sayfaya dön" : "go home"}
      </Link>
    </div>
  );
}
