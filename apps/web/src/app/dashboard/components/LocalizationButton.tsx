"use client";

import React, { useEffect, useState } from "react";
import {
  deleteLocalizationAction,
  getLocalizationAction,
  upsertLocalizationAction,
} from "../actions";
import MarkdownEditor from "../../components/MarkdownEditor";
import styles from "./LocalizationButton.module.css";
import {
  resolveInitialModalState,
  type LocalizationEntityType,
  type LocalizationField,
} from "./LocalizationButton.helpers";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";

type InputType = "input" | "textarea";

interface LocalizationButtonProps {
  entityType: LocalizationEntityType;
  entityId?: string;
  field: LocalizationField;
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
  const [hasSavedTranslation, setHasSavedTranslation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
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
    setHasSavedTranslation(false);
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

    const resolved = resolveInitialModalState(result.data, initialValue);
    setValue(resolved.value);
    setHasSavedTranslation(resolved.hasSavedTranslation);
    setLoadingValue(false);
  };

  const close = () => {
    if (loading || removing) return;
    setOpen(false);
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!value.trim()) {
      setError(ds.localization.error);
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

    setHasSavedTranslation(true);
    setSuccess(true);
    setLoading(false);
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    setSuccess(false);

    const result = await deleteLocalizationAction({
      entityType,
      entityId,
      languageCode: "tr",
      field,
    });

    if (result.error) {
      setError(result.error);
      setRemoving(false);
      return;
    }

    setHasSavedTranslation(false);
    setValue(initialValue || "");
    setRemoving(false);
    setError(null);
    setSuccess(false);
    setOpen(false);
  };

  const busy = loading || removing || loadingValue;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={openPopup}
        title={ds.localization.triggerTitle.replace("{label}", label)}
      >
        {ds.localization.triggerText}
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
                {ds.localization.modalTitle.replace("{label}", label)}
              </h2>
              <button type="button" className={styles.close} onClick={close} aria-label={ds.localization.close}>
                x
              </button>
            </div>

            <div className={styles.form}>
              {error && <div className="errorMsg">{error}</div>}
              {success && <div className="successMsg">{ds.localization.saved}</div>}

              <div className="field">
                <label className="label">{ds.localization.language}</label>
                <select value="tr" disabled className={styles.select}>
                  <option value="tr">{ds.localization.languageOption}</option>
                </select>
              </div>

              <div className="field">
                <label className="label">{label}</label>
                {inputType === "textarea" ? (
                  <MarkdownEditor
                    value={value}
                    onChange={setValue}
                    placeholder={loadingValue ? ds.localization.loadingPlaceholder : ds.localization.writePlaceholder.replace("{label}", label)}
                    rows={8}
                  />
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={loadingValue ? ds.localization.loadingPlaceholder : undefined}
                    className={styles.input}
                  />
                )}
              </div>

              <div className={styles.actions}>
                {hasSavedTranslation && (
                  <Button
                    type="button"
                    variant="ghost"
                    className={styles.removeBtn}
                    disabled={busy}
                    onClick={handleRemove}
                  >
                    {removing ? ds.localization.removing : ds.localization.remove}
                  </Button>
                )}
                <div className={styles.actionsRight}>
                  <Button type="button" variant="ghost" disabled={loading || removing} onClick={close}>
                    {ds.localization.cancel}
                  </Button>
                  <Button type="button" variant="accent" disabled={busy} onClick={handleSave}>
                    {loading ? ds.localization.saving : ds.localization.save}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
