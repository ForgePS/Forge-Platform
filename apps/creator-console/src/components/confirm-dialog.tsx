"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "../app/page.module.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <button
        type="button"
        className={styles.dialogBackdropButton}
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.dialogTitle}>
          {title}
        </h2>
        <div className={styles.dialogBody}>{description}</div>
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.buttonSecondary}
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? styles.buttonDanger : styles.button}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
