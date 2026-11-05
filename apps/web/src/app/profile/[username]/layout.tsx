import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../profile.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { libraryMetadata } from "../../../lib/librarySeo";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../lib/profileLibrary";
import { librarySignOutAction } from "../../../components/library/actions";
import ProfileTabs from "../components/ProfileTabs";

interface ProfileLayoutProps {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata(props: Omit<ProfileLayoutProps, "children">) {
  const { username } = await props.params;
  const result = await getProfileLibrary(decodeUsername(username));
  // Unknown user: the /profile layout's defaults apply.
  if (result.kind === "not_found") return {};
  const dict = getDictionary(await getActiveLanguage());
  // Private: a generic title; the API withholds the display name and it must not leak.
  if (result.kind === "private") {
    return libraryMetadata({
      section: "games",
      title: dict.profile_private_title,
      description: dict.profile_private_message,
      robots: { index: false },
    });
  }
  const library = result.data;
  const name = library.user.displayName || library.user.username;
  return libraryMetadata({
    section: "games",
    title: name,
    description: dict.profile_description.replace("{name}", name),
    // Profiles stay out of search results for now.
    robots: { index: false },
  });
}

/** Profile header (identity, owner tools) and section tabs, shared by every visible profile page. */
export default async function UserProfileLayout(props: ProfileLayoutProps) {
  const { username } = await props.params;
  const result = await getProfileLibrary(decodeUsername(username));
  if (result.kind === "not_found") notFound();
  // Private: each page renders the private state itself, since it knows its own path to return to after sign-in.
  if (result.kind === "private") return <>{props.children}</>;

  const library = result.data;
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const { user, isOwner } = library;
  const name = user.displayName || user.username;

  return (
    <div>
      <div className={styles.band}>
        <header className={styles.profileHeader}>
          <div className={styles.identity}>
            <h1 className={styles.displayName}>{name}</h1>
            <p className={styles.handle}>
              <span>@{user.username}</span>
              {isOwner && !user.isProfilePublic && (
                <span className={styles.badge}>
                  <LockIcon />
                  {dict.profile_private}
                </span>
              )}
            </p>
          </div>

          {isOwner && (
            <div className={styles.ownerTools}>
              <Link href={localizeHref("/profile/settings", lang)} className={`btnGhost ${styles.settingsLink}`}>
                {dict.settings}
              </Link>
              <form action={librarySignOutAction} className={styles.signOutForm}>
                <input type="hidden" name="returnTo" value={localizeHref("/games", lang)} />
                <button type="submit" className={`btnGhost ${styles.signOutButton}`}>
                  {dict.sign_out}
                </button>
              </form>
            </div>
          )}
        </header>

        <ProfileTabs basePath={profilePath(user.username)} gameCount={library.summary.gameCount} />
      </div>

      <div className={styles.content}>{props.children}</div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
