"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";

export function useFxSelection(initial?: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initial ?? []));

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds(checked ? new Set(ids) : new Set());
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, toggleRow, toggleAll, clear, setSelectedIds };
}

export function FxSelection({
  selectedCount,
  children,
}: {
  selectedCount: number;
  children?: ReactNode;
}) {
  return (
    <div className="rms-fx-selection" role="status" aria-live="polite">
      {selectedCount > 0 ? `${selectedCount} selected` : "None selected"}
      {children}
    </div>
  );
}

/** Only render actions the product already supports. */
export function FxBulkActions({
  actions,
  disabled,
}: {
  actions: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean }>;
  disabled?: boolean;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="rms-fx-bulk-actions" role="group" aria-label="Bulk actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={disabled || action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function FxRowActions({ children }: { children: ReactNode }) {
  return <div className="rms-fx-row-actions">{children}</div>;
}

/** Export hook presentation — only when product provides an existing export handler. */
export function FxExport({
  onExport,
  label = "Export",
  disabled,
}: {
  onExport?: () => void;
  label?: string;
  disabled?: boolean;
}) {
  if (!onExport) return null;
  return (
    <button type="button" className="rms-fx-export" onClick={onExport} disabled={disabled}>
      {label}
    </button>
  );
}
