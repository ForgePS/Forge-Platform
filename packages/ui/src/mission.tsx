"use client";

import type { ReactNode } from "react";

export type TimelineItem = {
  id: string;
  title: string;
  detail?: string;
  at?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

export function ActivityTimeline({ items, emptyLabel = "No activity yet." }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (!items.length) {
    return <p className="forge-muted">{emptyLabel}</p>;
  }
  return (
    <ol className="forge-timeline">
      {items.map((item) => (
        <li key={item.id} className={`forge-timeline__item forge-timeline__item--${item.tone ?? "neutral"}`}>
          <div className="forge-timeline__marker" aria-hidden />
          <div className="forge-timeline__content">
            <p className="forge-timeline__title">{item.title}</p>
            {item.detail ? <p className="forge-timeline__detail">{item.detail}</p> : null}
            {item.at ? <time className="forge-timeline__at">{item.at}</time> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const AuditTimeline = ActivityTimeline;

export function UserAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={`forge-avatar forge-avatar--${size}`} title={name} aria-label={name}>
      {initials || "?"}
    </span>
  );
}

export function TenantAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <UserAvatar name={name} size={size} />;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="forge-form-field">
      <span className="forge-form-field__label">
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </span>
      <input
        id={id}
        type="date"
        className="forge-input"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="forge-multiselect">
      <legend className="forge-form-field__label">{label}</legend>
      <div className="forge-multiselect__options">
        {options.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <label key={opt.value} className="forge-multiselect__option" htmlFor={`${id}-${opt.value}`}>
              <input
                id={`${id}-${opt.value}`}
                type="checkbox"
                checked={checked}
                onChange={() => {
                  onChange(checked ? value.filter((v) => v !== opt.value) : [...value, opt.value]);
                }}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FileUploader({
  id,
  label,
  accept,
  onSelect,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  accept?: string;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="forge-file-uploader">
      <label htmlFor={id} className="forge-form-field__label">
        {label}
      </label>
      <input
        id={id}
        type="file"
        className="forge-input"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {hint ? <p className="forge-form-field__hint">{hint}</p> : null}
    </div>
  );
}

export type PermissionMatrixCell = {
  roleId: string;
  permissionId: string;
  granted: boolean;
};

export function PermissionMatrix({
  roles,
  permissions,
  cells,
  onToggle,
  readOnly,
  emptyLabel = "No permissions to display.",
}: {
  roles: Array<{ id: string; label: string }>;
  permissions: Array<{ id: string; label: string }>;
  cells: PermissionMatrixCell[];
  onToggle?: (roleId: string, permissionId: string, next: boolean) => void;
  readOnly?: boolean;
  emptyLabel?: string;
}) {
  if (!roles.length || !permissions.length) {
    return <p className="forge-muted">{emptyLabel}</p>;
  }
  const lookup = new Map(cells.map((c) => [`${c.roleId}:${c.permissionId}`, c.granted]));
  return (
    <div className="forge-permission-matrix" role="grid" aria-label="Permission matrix">
      <table>
        <thead>
          <tr>
            <th scope="col">Permission</th>
            {roles.map((r) => (
              <th key={r.id} scope="col">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.label}</th>
              {roles.map((r) => {
                const granted = lookup.get(`${r.id}:${p.id}`) ?? false;
                return (
                  <td key={`${r.id}:${p.id}`}>
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={readOnly || !onToggle}
                      aria-label={`${r.label}: ${p.label}`}
                      onChange={() => onToggle?.(r.id, p.id, !granted)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComingLater({ children = "Coming later" }: { children?: ReactNode }) {
  return <p className="forge-coming-later">{children}</p>;
}
