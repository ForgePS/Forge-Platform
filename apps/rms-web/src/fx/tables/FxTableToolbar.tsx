"use client";

import type { ReactNode } from "react";

/** Toolbar slot — wrap existing ListControlsView or custom filters without changing their behavior. */
export function FxTableToolbar({ children }: { children?: ReactNode }) {
  return <div className="rms-fx-table-toolbar">{children}</div>;
}

export function FxSearch({
  value,
  onChange,
  label = "Search",
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  loading?: boolean;
}) {
  return (
    <div className="rms-fx-search">
      <label htmlFor="rms-fx-search-input">{label}</label>
      <div className="rms-fx-search__row">
        <input
          id="rms-fx-search-input"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-busy={loading || undefined}
        />
        {value ? (
          <button type="button" onClick={() => onChange("")} aria-label="Clear search">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FxFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rms-fx-filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FxPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="rms-fx-pagination" aria-label="Pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

export function FxSort({
  value,
  options,
  onChange,
  label = "Sort",
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <label className="rms-fx-filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
