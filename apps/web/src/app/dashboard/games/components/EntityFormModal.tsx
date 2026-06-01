import React from "react";
import styles from "./EntityFormModal.module.css";
import { EntityType } from "../types";
import ds from "../../../../lib/dashboard-strings";

interface EntityFormModalProps {
  activeType: EntityType;
  editing: boolean;
  error: string | null;
  onClose: () => void;
  children: React.ReactNode;
}

export default function EntityFormModal({
  activeType,
  editing,
  error,
  onClose,
  children,
}: EntityFormModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={activeType === "game" ? styles.modalContentLarge : styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {editing
              ? ds.games.modalTitle.edit.replace("{type}", activeType)
              : ds.games.modalTitle.new.replace("{type}", activeType)}
          </h3>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            &times;
          </button>
        </div>
        {error && <div className={styles.errorMsg}>{error}</div>}
        {children}
      </div>
    </div>
  );
}
