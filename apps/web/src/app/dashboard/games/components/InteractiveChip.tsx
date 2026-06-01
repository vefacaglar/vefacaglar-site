import React from "react";
import styles from "./InteractiveChip.module.css";
import { Genre, Platform, Theme } from "../types";
import ds from "../../../../lib/dashboard-strings";

type ChipItem = Genre | Theme | Platform;
type ChipType = "genre" | "theme" | "platform";

interface InteractiveChipProps {
  item: ChipItem;
  type: ChipType;
  onEdit: (type: ChipType, item: ChipItem) => void;
  onDelete: (type: ChipType, item: ChipItem) => void;
}

export default function InteractiveChip({ item, type, onEdit, onDelete }: InteractiveChipProps) {
  return (
    <div className={styles.interactiveChip}>
      <span className={styles.interactiveChipName}>{item.name}</span>
      <span className={styles.interactiveChipSlug}>{item.slug}</span>
      <div className={styles.interactiveChipActions}>
        <button
          type="button"
          className={styles.chipActionBtn}
          onClick={() => onEdit(type, item)}
          title={`${ds.games.buttons.edit} ${type}`}
        >
          {ds.games.buttons.edit}
        </button>
        <button
          type="button"
          className={`${styles.chipActionBtn} ${styles.chipActionDelete}`}
          onClick={() => onDelete(type, item)}
          title={`${ds.games.buttons.delete} ${type}`}
        >
          {ds.games.buttons.delete}
        </button>
      </div>
    </div>
  );
}
