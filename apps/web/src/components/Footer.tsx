"use client";

import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./Footer.module.css";

const LIBRARY_PREFIXES = ["/games", "/movies", "/profile"];

interface FooterProps {
  dict: {
    back_to_home: string;
  };
}

export default function Footer({ dict }: FooterProps) {
  const pagePath = usePathname() || "/";

  if (LIBRARY_PREFIXES.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <span className={styles.footerMark}>{dict.back_to_home}</span>
      <LanguageSwitcher />
    </footer>
  );
}
