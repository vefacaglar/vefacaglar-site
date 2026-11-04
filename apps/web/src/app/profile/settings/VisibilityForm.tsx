"use client";

import { useState, useTransition } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { getDictionary } from "../../../dictionaries";
import { saveProfileVisibility } from "./actions";
import styles from "../profile.module.css";

/** Public / private choice for the library profile, saved explicitly. */
export default function VisibilityForm({
  initialPublic,
  publicUrl,
}: {
  initialPublic: boolean;
  /** Absolute link to the user's profile, shown while it is public. */
  publicUrl: string;
}) {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [selected, setSelected] = useState(initialPublic);
  const [saved, setSaved] = useState(initialPublic);
  const [status, setStatus] = useState<"idle" | "saved" | "copied">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = [
    { value: true, label: dict.visibility_public, hint: dict.visibility_public_hint },
    { value: false, label: dict.visibility_private, hint: dict.visibility_private_hint },
  ];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      const result = await saveProfileVisibility(selected);
      if (result.error !== undefined) {
        setError(result.error);
        return;
      }
      setSaved(result.isProfilePublic);
      setSelected(result.isProfilePublic);
      setStatus("saved");
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setStatus("copied");
    } catch {
      // Clipboard can be blocked; the link stays visible to copy by hand.
    }
  };

  return (
    <form className={styles.settingsForm} onSubmit={onSubmit}>
      <fieldset className={styles.choiceGroup}>
        <legend className={styles.settingsLabel}>{dict.visibility_title}</legend>
        <div className={styles.choices}>
          {options.map((option) => (
            <label key={String(option.value)} className={styles.choice}>
              <input
                type="radio"
                name="visibility"
                className={styles.choiceInput}
                checked={selected === option.value}
                onChange={() => {
                  setSelected(option.value);
                  setStatus("idle");
                }}
              />
              <span className={styles.choiceBody}>
                <span className={styles.choiceTitle}>{option.label}</span>
                <span className={styles.choiceHint}>{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="errorMsg">{error}</p>}

      <div className={styles.settingsActions}>
        <button type="submit" className="btnAccent" disabled={pending || selected === saved}>
          {dict.save}
        </button>
        <span className={styles.settingsStatus} role="status">
          {status === "saved" ? dict.saved : ""}
        </span>
      </div>

      {saved && (
        <div className={styles.publicLink}>
          <span className={styles.settingsLabel}>{dict.public_profile_url}</span>
          <div className={styles.publicLinkRow}>
            <a href={publicUrl} className={styles.publicUrl}>
              {publicUrl}
            </a>
            <button type="button" className="btnGhost" onClick={onCopy}>
              {status === "copied" ? dict.link_copied : dict.copy_link}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
