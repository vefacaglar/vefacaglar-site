import Link from "next/link";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { gameCompanyGroupHref, type GameSearchCompanies as Companies } from "../../../lib/gameSearch";
import styles from "./GameSearchCompanies.module.css";

/** Text-only developer and publisher matches shown above the games search grid. */
export default function GameSearchCompanies({ companies, lang }: { companies: Companies; lang: string }) {
  const dict = getDictionary(lang);
  const sections = [
    { group: "developers" as const, title: dict.games_search_developers, items: companies.developers },
    { group: "publishers" as const, title: dict.games_search_publishers, items: companies.publishers },
  ].filter((section) => section.items.length > 0);
  if (!sections.length) return null;

  const gameCount = (count: number) =>
    count === 1 ? dict.games_search_game_count_one : dict.games_search_game_count.replace("{count}", count.toLocaleString(lang));

  return (
    <div className={styles.companies}>
      {sections.map((section) => (
        <section key={section.group} className={styles.section} aria-labelledby={`games-search-${section.group}`}>
          <h2 id={`games-search-${section.group}`} className={styles.heading}>
            {section.title}
          </h2>
          <ul className={styles.list}>
            {section.items.map((company) => (
              <li key={company.slug}>
                <Link href={localizeHref(gameCompanyGroupHref(section.group, company.slug), lang)} className={styles.item}>
                  <span className={styles.name}>{company.name}</span>
                  <span className={styles.meta}>{gameCount(company.gameCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
