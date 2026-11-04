import styles from "./LibraryMasthead.module.css";

/** Section heading at the top of each library shelf: title, standfirst, optional tools. */
export default function LibraryMasthead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  /** Tools shown on the right of the subtitle row, e.g. search. */
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.masthead}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {children && <div className={styles.tools}>{children}</div>}
    </div>
  );
}
