import React from "react";
import styles from "./forms.module.css";
import ds from "../../../../lib/dashboard-strings";
import DatePicker from "../../../components/DatePicker";

export interface GameFieldsState {
  title: string;
  slug: string;
  originalTitle: string;
  description: string;
  coverImageUrl: string;
  releaseDate: string;
}

export type GameFieldKey = keyof GameFieldsState;
export type GameFieldValue<K extends GameFieldKey> = GameFieldsState[K];

interface GameFieldsFormProps {
  values: GameFieldsState;
  onChange: <K extends GameFieldKey>(key: K, value: GameFieldsState[K]) => void;
  disabled?: boolean;
  showPlaceholders?: boolean;
}

export default function GameFieldsForm({
  values,
  onChange,
  disabled,
  showPlaceholders = true,
}: GameFieldsFormProps) {
  return (
    <div>
      <div className={styles.formSectionTitle}>{ds.games.form.coreInfo}</div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-title">{ds.games.form.title}</label>
        <input
          id="game-title"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? ds.games.placeholders.title : undefined}
          value={values.title}
          onChange={(e) => onChange("title", e.target.value)}
          disabled={disabled}
          required
          autoFocus
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-slug">{ds.games.form.slug}</label>
        <input
          id="game-slug"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? ds.games.placeholders.slug : undefined}
          value={values.slug}
          onChange={(e) => onChange("slug", e.target.value)}
          disabled={disabled}
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-original-title">{ds.games.form.originalTitle}</label>
        <input
          id="game-original-title"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? ds.games.placeholders.originalTitle : undefined}
          value={values.originalTitle}
          onChange={(e) => onChange("originalTitle", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-description">{ds.games.form.description}</label>
        <textarea
          id="game-description"
          className={styles.textarea}
          placeholder={showPlaceholders ? ds.games.placeholders.description : undefined}
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-cover-image">{ds.games.form.coverImageUrl}</label>
        <input
          id="game-cover-image"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? ds.games.placeholders.coverImageUrl : undefined}
          value={values.coverImageUrl}
          onChange={(e) => onChange("coverImageUrl", e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="game-release-date">{ds.games.form.releaseDate}</label>
        <DatePicker
          id="game-release-date"
          value={values.releaseDate}
          onChange={(value) => onChange("releaseDate", value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
