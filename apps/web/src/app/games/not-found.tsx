import Link from "next/link";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./games.module.css";

// Unknown games stay inside the library and point back to the shelf, not the main site.
export default async function GameNotFound() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);

  return (
    <div className={styles.notFound}>
      <p className={styles.notFoundCode}>{dict.not_found_title}</p>
      <p className={styles.notFoundText}>{dict.library_not_found}</p>
      <Link href={localizeHref("/games", lang)} className="btnGhost">
        {dict.browse_games}
      </Link>
    </div>
  );
}
