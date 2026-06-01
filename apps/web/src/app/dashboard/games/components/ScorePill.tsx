import React from "react";
import styles from "./ScorePill.module.css";

interface ScorePillProps {
  score: number;
  label: string;
  title: string;
}

export default function ScorePill({ score, label, title }: ScorePillProps) {
  const variantClass =
    score >= 90 ? styles.high : score >= 75 ? styles.mid : "";

  return (
    <span className={`${styles.scorePill} ${variantClass}`} title={title}>
      {label} {score}
    </span>
  );
}
