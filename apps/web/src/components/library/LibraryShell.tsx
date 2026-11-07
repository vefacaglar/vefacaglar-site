import Link from "next/link";
import { Suspense } from "react";
import LanguageSwitcher from "../LanguageSwitcher";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { getAuthMode, getLoginHref } from "../../lib/oidc";
import { getSessionUser } from "../../lib/session";
import { LIBRARY_NAME } from "../../lib/librarySeo";
import { profilePath } from "../../lib/profileLibrary";
import AccountLink from "./AccountLink";
import ExploreNavigation from "./ExploreNavigation";
import ExploreSignInLink from "./ExploreSignInLink";
import styles from "./LibraryShell.module.css";

/**
 * Frame shared by Explore and profiles, with persistent client-aware navigation.
 */
export default async function LibraryShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const user = await getSessionUser();

  return (
    <div className={styles.shell} data-library="" data-ui-theme="graphite">
      <header className={styles.header}>
        <Link href={localizeHref("/explore", lang)} className={styles.wordmark} aria-label={LIBRARY_NAME}>
          {dict.back_to_home}
        </Link>

        <ExploreNavigation lang={lang} labels={{ games: dict.games, movies: dict.movies }} />

        <div className={styles.utility}>
          {user ? (
            <AccountLink
              href={localizeHref(profilePath(user.username), lang)}
              profilePath={profilePath(user.username)}
              label={dict.profile}
            />
          ) : (
            <Suspense fallback={<Link href={getLoginHref(localizeHref("/explore", lang))} className={styles.account}>{dict.sign_in}</Link>}>
              <ExploreSignInLink label={dict.sign_in} oidc={getAuthMode() === "oidc"} />
            </Suspense>
          )}
        </div>
      </header>

      <div className={styles.body}>{children}</div>

      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <span className={styles.footerMark}>{dict.back_to_home}</span>
          <LanguageSwitcher />
        </div>
        <p className={styles.sources}>
          Game data: <a href="https://www.igdb.com/">IGDB</a>.{" "}
          Film data: <a href="https://www.wikidata.org/">Wikidata</a>.{" "}
          Page-view data: <a href="https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html">Wikimedia Analytics (CC0)</a>.{" "}
          Posters: <a href="https://en.wikipedia.org/">Wikipedia</a> and <a href="https://commons.wikimedia.org/">Wikimedia Commons</a>.{" "}
          Individual poster credits and licenses are shown with each image.
        </p>
      </footer>
    </div>
  );
}
