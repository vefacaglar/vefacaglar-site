import Link from "next/link";
import { localizeHref } from "../../lib/localizeHref";
import { personHref } from "../../lib/people";
import type { TvCastPerson } from "../../lib/tvSeries";
import styles from "./tvSeries.module.css";
export default function TvCast({ cast, lang }: { cast: TvCastPerson[]; lang: string }) {
  return <ul className={styles.list}>{cast.map((person) => <li className={styles.item} key={person.personId}>
    <Link className={styles.card} href={localizeHref(personHref(person.personId), lang)}>
      <span className={styles.title}>{person.name || "Unnamed cast member"}</span>
      <span className={styles.meta}>{person.roles.map((role) => <span key={role.characterId}>
        {[role.name, role.voice ? "Voice" : null, role.self ? "Self" : null].filter(Boolean).join(" · ") || "Cast"}
      </span>)}</span>
    </Link>
  </li>)}</ul>;
}
