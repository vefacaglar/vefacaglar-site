import Link from "next/link";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { getLoginHref } from "../../../lib/oidc";

/**
 * Shown in place of a private profile. Only the @username from the address is
 * repeated; nothing the API withheld (display name, library) appears here.
 */
export default function PrivateProfile({
  username,
  path,
  signedIn,
  lang,
}: {
  username: string;
  /** Unlocalized path of the page being viewed, to come back to after sign-in. */
  path: string;
  /** Signed in as someone else (403) rather than signed out (401). */
  signedIn: boolean;
  lang: string;
}) {
  const dict = getDictionary(lang);

  return (
    <section className={styles.privateState}>
      <div className={styles.privatePlate} aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
          <rect x="5" y="11" width="14" height="10" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <p className={styles.privateHandle}>@{username}</p>
      <h1 className={styles.privateTitle}>{dict.profile_private_message}</h1>
      {signedIn ? (
        <Link href={localizeHref("/games", lang)} className="btnGhost">
          {dict.browse_games}
        </Link>
      ) : (
        <>
          <p className={styles.muted}>{dict.profile_private_sign_in_hint}</p>
          <Link href={getLoginHref(localizeHref(path, lang))} className="btnAccent">
            {dict.sign_in}
          </Link>
        </>
      )}
    </section>
  );
}
