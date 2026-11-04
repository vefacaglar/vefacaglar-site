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
import { librarySignOutAction } from "./actions";
import { librarySans } from "./fonts";
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
    <div className={`${styles.shell} ${librarySans.variable}`} data-library="">
      <header className={styles.header}>
        {/* The library's home is /games; the name is a brand, so it is not translated. */}
        <Link href={localizeHref("/games", lang)} className={styles.wordmark} aria-label={LIBRARY_NAME}>
          <span className={styles.owner}>Vefa</span>
          <span className={styles.name}>Library</span>
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
            <>
              <AccountLink
                href={localizeHref(profilePath(user.username), lang)}
                profilePath={profilePath(user.username)}
                label={user.displayName || user.username || dict.profile}
              />
              <form action={librarySignOutAction} className={styles.signOutForm}>
                <input type="hidden" name="returnTo" value={localizeHref("/games", lang)} />
                <button type="submit" className={styles.signOut}>
                  {dict.sign_out}
                </button>
              </form>
            </>
          ) : (
            <Link href={getLoginHref(localizeHref(`/${section ?? "games"}`, lang))} className={styles.account}>
              {dict.sign_in}
            </Link>
          )}
        </div>
      </header>

      <div className={styles.body}>{children}</div>

      <footer className={styles.footer}>
        <span className={styles.footerMark}>{LIBRARY_NAME}</span>
        <LanguageSwitcher />
      </footer>
    </div>
  );
}
