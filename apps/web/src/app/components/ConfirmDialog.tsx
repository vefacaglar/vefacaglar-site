"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A native modal confirmation, used before destructive actions. */
export default function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const messageId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={messageId}
      onCancel={(event) => {
        // Keep the native dialog open; visibility is owned by the `open` prop.
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // A click landing on the dialog element itself is a backdrop click.
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className={styles.body}>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button type="button" className="btnGhost" ref={cancelRef} disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btnAccent" disabled={pending} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
