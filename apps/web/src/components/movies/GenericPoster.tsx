import styles from "./genericPoster.module.css";

const VARIANTS = ["a", "b", "c", "d"] as const;

function variantFor(title: string) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return VARIANTS[hash % VARIANTS.length];
}

/** Our own typographic stand-in for a missing poster. Decorative: the title is repeated in nearby text. */
export default function GenericPoster({ title, year, size = "card" }: {
  title: string;
  year?: number | string | null;
  size?: "card" | "large";
}) {
  return <span className={`${styles.poster} ${size === "large" ? styles.large : ""}`} data-variant={variantFor(title)} aria-hidden="true">
    <span className={styles.frame}>
    <span className={styles.label}>Film</span>
    <span className={styles.rule} />
    <span className={styles.title}>{title}</span>
    {year !== null && year !== undefined && year !== "" && <span className={styles.year}>{year}</span>}
    </span>
  </span>;
}
