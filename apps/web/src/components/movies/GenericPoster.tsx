import styles from "./genericPoster.module.css";

/** Our own typographic stand-in for a missing poster. Decorative: the title is repeated in nearby text. */
export default function GenericPoster({
  title,
  year,
  kicker = "Film",
  size = "card",
}: {
  title: string;
  year?: number | string | null;
  kicker?: string;
  size?: "card" | "large";
}) {
  return <span className={`${styles.poster} ${size === "large" ? styles.large : ""}`} aria-hidden="true">
    <span className={styles.frame}>
    <span className={styles.label}>{kicker}</span>
    <span className={styles.rule} />
    <span className={styles.title}>{title}</span>
    {year !== null && year !== undefined && year !== "" && <span className={styles.year}>{year}</span>}
    </span>
  </span>;
}
