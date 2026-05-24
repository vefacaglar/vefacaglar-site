"use client";

import React, { useEffect, useState } from "react";
import { getLocalizationAction, upsertLocalizationAction } from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import styles from "./LocalizationButton.module.css";
import Button from "../../../components/Button";

type EntityType = "page" | "post" | "project";
type InputType = "input" | "textarea";

interface LocalizationButtonProps {
  entityType: EntityType;
  entityId?: string;
  field: string;
  label: string;
  initialValue?: string | null;
  inputType?: InputType;
}

export default function LocalizationButton({
  entityType,
  entityId,
  field,
  label,
  initialValue,
  inputType = "input",
}: LocalizationButtonProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingValue, setLoadingValue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!entityId) return null;

  const openPopup = async () => {
    setValue(initialValue || "");
    setError(null);
    setSuccess(false);
    setOpen(true);
    setLoadingValue(true);

    const result = await getLocalizationAction({
      entityType,
      entityId,
      languageCode: "tr",
      field,
    });

    if (result.error) {
      setError(result.error);
      setLoadingValue(false);
      return;
    }

    setValue(result.data?.value || initialValue || "");
    setLoadingValue(false);
  };

  const close = () => {
    if (loading) return;
    setOpen(false);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!value.trim()) {
      setError("Please enter a translation.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await upsertLocalizationAction({
      entityType,
      entityId,
      languageCode: "tr",
      field,
      value: value.trim(),
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={openPopup}
        title={`Add Turkish translation for ${label}`}
      >
        TR
      </button>

      {open && (
        <div className={styles.overlay} role="presentation" onMouseDown={close}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`localization-${entityType}-${field}`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 id={`localization-${entityType}-${field}`} className={styles.title}>
                Turkish Translation: {label}
              </h2>
              <button type="button" className={styles.close} onClick={close} aria-label="Close">
                x
              </button>
            </div>

            <div className={styles.form}>
              {error && <div className="errorMsg">{error}</div>}
              {success && <div className="successMsg">Localization saved.</div>}

              <div className="field">
                <label className="label">Language</label>
                <select value="tr" disabled className={styles.select}>
                  <option value="tr">Turkish</option>
                </select>
              </div>

              <div className="field">
                <label className="label">{label}</label>
                {inputType === "textarea" ? (
                  <MarkdownEditor
                    value={value}
                    onChange={setValue}
                    placeholder={loadingValue ? "Loading translation..." : `Write Turkish translation for ${label}...`}
                    rows={8}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={loadingValue ? "Loading translation..." : undefined}
                    className={styles.input}
                  />
                )}
              </div>

              <div className={styles.actions}>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" disabled={loading || loadingValue} onClick={handleSave}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
