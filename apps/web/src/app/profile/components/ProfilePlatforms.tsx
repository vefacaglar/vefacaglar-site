import profile from "../profile.module.css";
import styles from "./ProfilePlatforms.module.css";
import { getDictionary } from "../../../dictionaries";
import type { LibraryPlatformCount } from "../../../lib/profileLibrary";

type ProfilePlatformsProps = {
  platforms: LibraryPlatformCount[];
  lang: string;
};

/**
 * Where the games were played: one row per platform with its share of the shelf
 * as an accent bar standing on a hairline. The bar is SVG sized by attribute, so it
 * needs no inline style; the figures beside it carry the same information as text.
 */
export default function ProfilePlatforms({ platforms, lang }: ProfilePlatformsProps) {
  const dict = getDictionary(lang);
  const total = platforms.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) return null;

  // Ties for the top spot share the full accent.
  const most = Math.max(...platforms.map((p) => p.count));
  const percent = new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB", { style: "percent" });

  return (
    <section className={`${profile.section} ${styles.platforms}`} aria-labelledby="profile-platforms-title">
      <div className={profile.sectionHead}>
        <h2 id="profile-platforms-title" className={profile.sectionTitle}>
          {dict.platforms}
        </h2>
      </div>
      <ol className={styles.list} aria-label={dict.platforms_label}>
        {platforms.map((platform) => {
          const share = platform.count / total;
          const games = (platform.count === 1 ? dict.platform_games_one : dict.platform_games_other).replace(
            "{count}",
            String(platform.count),
          );
          return (
            <li key={platform.name} className={styles.item} data-lead={platform.count === most ? "" : undefined}>
              <span className={styles.name}>{platform.name}</span>
              <svg className={styles.bar} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                <rect className={styles.track} x="0" y="5" width="100" height="1" />
                <rect className={styles.fill} x="0" y="0" width={Math.max(0.6, share * 100)} height="5" />
              </svg>
              <span className={styles.percent}>{percent.format(Math.round(share * 100) / 100)}</span>
              <span className={styles.count}>{games}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
