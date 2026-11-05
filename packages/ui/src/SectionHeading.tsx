import type { ReactNode } from "react";
import styles from "./SectionHeading.module.css";

export interface SectionHeadingProps {
  title: string;
  subtitle: string;
  /** Optional tools displayed beside the heading on wide screens. */
  children?: ReactNode;
}

/** Section heading at the top of each library shelf: title, standfirst, optional tools. */
export function SectionHeading({
  title,
  subtitle,
  children,
}: SectionHeadingProps) {
  return (
    <div className={styles.masthead}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {children && <div className={styles.tools}>{children}</div>}
    </div>
  );
}
