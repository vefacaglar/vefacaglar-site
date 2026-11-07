import Link from "next/link";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";

/** Empty shelf: an invitation for the owner, a plain note for visitors. */
export default function ProfileEmpty({ isOwner, name, lang }: { isOwner: boolean; name: string; lang: string }) {
  const dict = getDictionary(lang);

  return (
    <div className={styles.empty}>
      <p className={styles.muted}>
        {isOwner ? dict.no_library : dict.profile_no_games_visitor.replace("{name}", name)}
      </p>
      {isOwner && (
        <Link href={localizeHref("/explore/games", lang)} className="btnAccent">
          {dict.browse_games}
        </Link>
      )}
    </div>
  );
}
