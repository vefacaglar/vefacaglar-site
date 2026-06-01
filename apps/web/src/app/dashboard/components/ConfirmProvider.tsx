"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import styles from "./ConfirmModal.module.css";

interface ConfirmContextType {
  confirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    message: string;
    title: string;
    confirmText: string;
    cancelText: string;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((
    message: string,
    options?: { title?: string; confirmText?: string; cancelText?: string }
  ) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        message,
        title: options?.title || "confirm action",
        confirmText: options?.confirmText || "yes, delete",
        cancelText: options?.cancelText || "cancel",
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  };

  const handleCancel = () => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state?.isOpen && (
        <div className={styles.overlay} onClick={handleCancel}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h3 className={styles.title}>{state.title}</h3>
              <button type="button" className={styles.close} onClick={handleCancel}>&times;</button>
            </div>
            <div className={styles.body}>
              <p className={styles.message}>{state.message}</p>
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className="btnGhost"
                onClick={handleCancel}
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                className="btnAccent"
                onClick={handleConfirm}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
