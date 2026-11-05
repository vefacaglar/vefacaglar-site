import Link from "next/link";
import LanguageSwitcher from "../LanguageSwitcher";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { getLoginHref } from "../../lib/oidc";
import { getSessionUser } from "../../lib/session";
import { LIBRARY_NAME, LIBRARY_SECTIONS, type LibrarySection } from "../../lib/librarySeo";
import { profilePath } from "../../lib/profileLibrary";
import AccountLink from "./AccountLink";
import styles from "./LibraryShell.module.css";

export type { LibrarySection };

/**
 * Frame shared by the library pages (games, movies, profile): its own wordmark and
 * section tabs in place of the site breadcrumb. The library stands on its own, so it
 * does not link back to the main site.
 */
export default async function LibraryShell({
  section,
  children,
}: {
  /** Active tab; omitted on pages outside the sections, such as the profile. */
  section?: LibrarySection;
  children: React.ReactNode;
}) {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className={styles.shell} data-library="">
      <header className={styles.header}>
        {/* The library's home is /games; uses the main site's vefacaglar wordmark. */}
        <Link href={localizeHref("/games", lang)} className={styles.wordmark} aria-label={LIBRARY_NAME}>
          {dict.back_to_home}
        </Link>

        <nav className={styles.tabs} aria-label={dict.library_nav}>
          {LIBRARY_SECTIONS.map((key) => (
            <Link
              key={key}
              href={localizeHref(`/${key}`, lang)}
              className={key === section ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              aria-current={key === section ? "true" : undefined}
            >
              {dict[key]}
            </Link>
          ))}
        </nav>

        <div className={styles.utility}>
          {user ? (
            <AccountLink
              href={localizeHref(profilePath(user.username), lang)}
              profilePath={profilePath(user.username)}
              label={dict.profile}
            />
          ) : (
            <Link href={getLoginHref(localizeHref(`/${section ?? "games"}`, lang))} className={styles.account}>
              {dict.sign_in}
            </Link>
          )}
        </div>
      </header>

      <div className={styles.body}>{children}</div>

      <footer className={styles.footer}>
        <span className={styles.footerMark}>{dict.back_to_home}</span>
        <LanguageSwitcher />
      </footer>
    </div>
  );
}
