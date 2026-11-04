import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "../profile.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { getLoginHref } from "../../../lib/oidc";
import { getSessionUser } from "../../../lib/session";
import { libraryMetadata } from "../../../lib/librarySeo";
import { profilePath } from "../../../lib/profileLibrary";
import { SITE_URL } from "../../../lib/seo";
import VisibilityForm from "./VisibilityForm";

export async function generateMetadata() {
  const dict = getDictionary(await getActiveLanguage());
  return libraryMetadata({
    section: "games",
    title: dict.settings,
    description: dict.visibility_title,
    robots: { index: false },
  });
}

export default async function ProfileSettings() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const user = await getSessionUser();
  if (!user) redirect(getLoginHref(localizeHref("/profile/settings", lang)));

  const ownProfile = profilePath(user.username);

  return (
    <article className={styles.settings}>
      <p className={styles.backLink}>
        <Link href={localizeHref(ownProfile, lang)}>← {dict.back_to_profile}</Link>
      </p>
      <h1 className={styles.settingsTitle}>{dict.settings}</h1>
      <VisibilityForm initialPublic={user.isProfilePublic} publicUrl={`${SITE_URL}${ownProfile}`} />
    </article>
  );
}
