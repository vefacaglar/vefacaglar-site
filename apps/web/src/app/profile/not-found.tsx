import Link from "next/link";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./profile.module.css";

// Unknown or private profiles stay inside the library and point back to the games shelf.
export default async function ProfileNotFound() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);

  return (
    <div className={styles.notFound}>
      <p className={styles.notFoundCode}>{dict.not_found_title}</p>
      <p className={styles.muted}>{dict.library_not_found}</p>
      <Link href={localizeHref("/explore/games", lang)} className="btnGhost">
        {dict.browse_games}
      </Link>
    </div>
  );
}
