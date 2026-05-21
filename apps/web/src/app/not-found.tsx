import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link href="/" className={styles.link}>Go home</Link>
    </div>
  );
}