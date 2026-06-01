import React from "react";
import styles from "./RelationPills.module.css";
import { GameRelationItem } from "../types";

export type RelationPillVariant = "dev" | "pub" | "genre" | "platform" | "theme";

export interface RelationPillSpec extends GameRelationItem {
  variant: RelationPillVariant;
  labelTitle: string;
}

interface RelationPillsProps {
  pills: RelationPillSpec[];
}

const VARIANT_CLASS: Record<RelationPillVariant, string> = {
  dev: styles.pillDev,
  pub: styles.pillPub,
  genre: styles.pillGenre,
  platform: styles.pillPlatform,
  theme: styles.pillTheme,
};

export default function RelationPills({ pills }: RelationPillsProps) {
  if (pills.length === 0) return null;
  return (
    <div className={styles.relationPills}>
      {pills.map(({ id, name, variant, labelTitle }) => (
        <span
          key={id}
          className={`${styles.pill} ${VARIANT_CLASS[variant]}`}
          title={`${labelTitle}: ${name}`}
        >
          {name}
        </span>
      ))}
    </div>
  );
}
