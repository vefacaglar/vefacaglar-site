import React from "react";
import Link from "next/link";
import styles from "./GameCompactRow.module.css";
import dashboardStyles from "../../dashboard.module.css";
import { Game } from "../types";
import ds from "../../../../lib/dashboard-strings";
import ScorePill from "./ScorePill";
import RelationPills, { RelationPillSpec } from "./RelationPills";

interface GameCompactRowProps {
  game: Game;
  editHref: string;
  onDelete: (game: Game) => void;
}

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function buildPills(game: Game): RelationPillSpec[] {
  const pills: RelationPillSpec[] = [];
  for (const d of game.developers) pills.push({ ...d, variant: "dev", labelTitle: ds.games.form.developers });
  for (const p of game.publishers) pills.push({ ...p, variant: "pub", labelTitle: ds.games.form.publishers });
  for (const g of game.genres) pills.push({ ...g, variant: "genre", labelTitle: ds.games.form.genres });
  for (const pl of game.platforms) pills.push({ ...pl, variant: "platform", labelTitle: ds.games.form.platforms });
  return pills;
}

export default function GameCompactRow({ game, editHref, onDelete }: GameCompactRowProps) {
  const initials = getInitials(game.title);
  const pills = buildPills(game);

  return (
    <div className={styles.gameCompactRow}>
      <div className={styles.gameCompactThumb}>
        {game.coverImageUrl ? (
          <img src={game.coverImageUrl} alt={game.title} className={styles.gameCompactImage} loading="lazy" />
        ) : (
          <div className={styles.gameCompactPlaceholder}>{initials}</div>
        )}
      </div>
      <div className={styles.gameCompactTitleCol}>
        <h4 className={styles.gameCompactTitle} title={game.title}>{game.title}</h4>
        {game.originalTitle && <div className={styles.gameCompactOriginalTitle}>{game.originalTitle}</div>}
      </div>
      <div className={styles.gameCompactScoresCol}>
        {game.metacriticScore && (
          <ScorePill score={game.metacriticScore} label={ds.games.card.metacritic} title={ds.games.form.metacriticScore} />
        )}
        {game.openCriticScore && (
          <ScorePill score={game.openCriticScore} label={ds.games.card.opencrit} title={ds.games.form.opencriticScore} />
        )}
      </div>
      <div className={styles.gameCompactMetaCol}>
        <span>{ds.games.card.release} {game.releaseDate || "—"}</span>
        {game.hltbMainHours && <span>{ds.games.card.hltb} {game.hltbMainHours}h</span>}
      </div>
      <div className={styles.gameCompactRelationsCol}>
        <RelationPills pills={pills} />
      </div>
      <div className={styles.gameCompactActionsCol}>
        <Link href={editHref} className={dashboardStyles.editLink}>{ds.games.buttons.edit}</Link>
        <button type="button" className={`${dashboardStyles.editLink} ${styles.linkBtnDanger}`} onClick={() => onDelete(game)}>
          {ds.games.buttons.delete}
        </button>
      </div>
    </div>
  );
}
