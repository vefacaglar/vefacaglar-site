"use client";

import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import FooterContent from "./FooterContent";
import styles from "./Footer.module.css";

const LIBRARY_PREFIXES = ["/explore", "/profile"];

interface FooterProps {
  content: string | null;
  dict: {
    back_to_home: string;
  };
}

export default function Footer({ dict, content }: FooterProps) {
  const pagePath = usePathname() || "/";

  if (LIBRARY_PREFIXES.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <span className={styles.footerMark}>{dict.back_to_home}</span>
      <div className={styles.footerEnd}>
        {content ? (
          <div className={styles.contact}>
            <FooterContent content={content} className={styles.contactLine} />
          </div>
        ) : (
          <a className={styles.contact} href="mailto:vefacaglar@outlook.com">
            vefacaglar@outlook.com
          </a>
        )}
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
