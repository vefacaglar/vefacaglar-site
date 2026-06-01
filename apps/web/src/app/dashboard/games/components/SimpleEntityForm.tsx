import React from "react";
import styles from "./forms.module.css";
import { EntityType } from "../types";
import ds from "../../../../lib/dashboard-strings";

interface SimpleEntityFormProps {
  activeType: EntityType;
  name: string;
  onNameChange: (v: string) => void;
  slug: string;
  onSlugChange: (v: string) => void;
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  disabled?: boolean;
  showPlaceholders?: boolean;
}

const NAME_PLACEHOLDERS: Record<EntityType, string> = {
  developer: ds.games.placeholders.developers,
  publisher: ds.games.placeholders.publishers,
  genre: ds.games.placeholders.genres,
  theme: ds.games.placeholders.themes,
  platform: ds.games.placeholders.platforms,
  game: "",
};

const SLUG_PLACEHOLDERS: Record<EntityType, string> = {
  developer: ds.games.placeholders.developerSlug,
  publisher: ds.games.placeholders.publisherSlug,
  genre: ds.games.placeholders.genreSlug,
  theme: ds.games.placeholders.themeSlug,
  platform: ds.games.placeholders.platformSlug,
  game: "",
};

export default function SimpleEntityForm({
  activeType,
  name,
  onNameChange,
  slug,
  onSlugChange,
  countryCode,
  onCountryCodeChange,
  disabled,
  showPlaceholders = true,
}: SimpleEntityFormProps) {
  const showCountry = activeType === "developer" || activeType === "publisher";

  return (
    <>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="item-name">{ds.games.form.name}</label>
        <input
          id="item-name"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? NAME_PLACEHOLDERS[activeType] : undefined}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          required
          autoFocus
        />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor="item-slug">{ds.games.form.slug}</label>
        <input
          id="item-slug"
          type="text"
          className={styles.input}
          placeholder={showPlaceholders ? SLUG_PLACEHOLDERS[activeType] : undefined}
          value={slug}
          onChange={(e) => onSlugChange(e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      {showCountry && (
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="item-country">{ds.games.form.countryCode}</label>
          <input
            id="item-country"
            type="text"
            maxLength={2}
            className={styles.input}
            placeholder={showPlaceholders ? ds.games.placeholders.countryCode : undefined}
            value={countryCode}
            onChange={(e) => onCountryCodeChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      )}
    </>
  );
}
