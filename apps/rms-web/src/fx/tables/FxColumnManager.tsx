"use client";

import { useMemo, useState } from "react";

export type ColumnPreference = {
  id: string;
  visible: boolean;
  order: number;
  width?: number;
  pinned?: "left" | "right" | null;
};

const STORAGE_PREFIX = "fx.rms.table.columns.v1:";

export function loadColumnPreferences(
  tableId: string,
  defaults: ColumnPreference[],
): ColumnPreference[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${tableId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as ColumnPreference[];
    if (!Array.isArray(parsed)) return defaults;
    const map = new Map(parsed.map((p) => [p.id, p]));
    return defaults.map((d) => {
      const saved = map.get(d.id);
      return saved
        ? {
            ...d,
            visible: saved.visible,
            order: saved.order,
            ...(saved.width !== undefined ? { width: saved.width } : {}),
            pinned: saved.pinned ?? null,
          }
        : d;
    });
  } catch {
    return defaults;
  }
}

export function saveColumnPreferences(tableId: string, prefs: ColumnPreference[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function FxColumnManager({
  tableId,
  columns,
  onChange,
}: {
  tableId: string;
  columns: ColumnPreference[];
  onChange: (next: ColumnPreference[]) => void;
}) {
  return (
    <div className="rms-fx-column-manager" role="group" aria-label="Column visibility">
      {columns
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((col) => (
          <label key={col.id} className="rms-fx-field__check">
            <input
              type="checkbox"
              checked={col.visible}
              onChange={(e) => {
                const next = columns.map((c) =>
                  c.id === col.id ? { ...c, visible: e.target.checked } : c,
                );
                onChange(next);
                saveColumnPreferences(tableId, next);
              }}
            />
            <span>{col.id}</span>
          </label>
        ))}
    </div>
  );
}

export function FxColumnChooser(props: Parameters<typeof FxColumnManager>[0]) {
  return <FxColumnManager {...props} />;
}

/** Resize hooks — stores width locally; visual resize is future-ready. */
export function FxColumnResize({
  tableId,
  columnId,
  width,
  onWidthChange,
}: {
  tableId: string;
  columnId: string;
  width: number;
  onWidthChange: (width: number) => void;
}) {
  return (
    <label className="rms-fx-column-resize">
      <span className="rms-fx-sr-only">Width for {columnId}</span>
      <input
        type="range"
        min={80}
        max={480}
        value={width}
        onChange={(e) => {
          const next = Number(e.target.value);
          onWidthChange(next);
          const prefs = loadColumnPreferences(tableId, [
            { id: columnId, visible: true, order: 0, width: next },
          ]);
          saveColumnPreferences(
            tableId,
            prefs.map((p) => (p.id === columnId ? { ...p, width: next } : p)),
          );
        }}
      />
    </label>
  );
}

/** Pin control — future-ready persistence. */
export function FxColumnPin({
  pinned,
  onChange,
}: {
  pinned: "left" | "right" | null;
  onChange: (next: "left" | "right" | null) => void;
}) {
  return (
    <select
      aria-label="Pin column"
      value={pinned ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "left" || v === "right" ? v : null);
      }}
    >
      <option value="">Unpinned</option>
      <option value="left">Pin left</option>
      <option value="right">Pin right</option>
    </select>
  );
}

export function useColumnPreferences(tableId: string, defaults: ColumnPreference[]) {
  const initial = useMemo(() => loadColumnPreferences(tableId, defaults), [tableId, defaults]);
  const [prefs, setPrefs] = useState(initial);
  return {
    prefs,
    setPrefs: (next: ColumnPreference[]) => {
      setPrefs(next);
      saveColumnPreferences(tableId, next);
    },
  };
}
