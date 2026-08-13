import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../primitives.js";
import type { ForgeShellTenant } from "./types.js";

export function ForgeTenantSwitcher({
  tenants,
  activeTenantId,
  onSelect,
  disabled,
  label = "Customer",
  searchable = true,
}: {
  tenants: ForgeShellTenant[];
  activeTenantId?: string | null;
  onSelect: (tenantId: string) => void;
  disabled?: boolean;
  label?: string;
  /** When true (default), use compact searchable popover. Small lists still get search. */
  searchable?: boolean;
}) {
  const selectable = tenants.filter((t) => t.selectable !== false);
  const active = selectable.find((t) => t.tenantId === activeTenantId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectable;
    return selectable.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) || t.tenantId.toLowerCase().includes(q),
    );
  }, [query, selectable]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  if (selectable.length === 0) {
    return <span className="forge-topbar__meta">No customers</span>;
  }

  if (!searchable && selectable.length <= 5) {
    return (
      <label className="forge-tenant-switcher forge-tenant-switcher--inline">
        <span className="forge-tenant-switcher__label">{label}</span>
        <select
          className="forge-select"
          aria-label={`Switch ${label.toLowerCase()}`}
          disabled={disabled}
          value={activeTenantId ?? ""}
          onChange={(e) => {
            if (e.target.value) onSelect(e.target.value);
          }}
        >
          {selectable.map((t) => (
            <option key={t.tenantId} value={t.tenantId}>
              {t.displayName}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div className="forge-tenant-switcher" ref={rootRef}>
      <span className="forge-tenant-switcher__label">{label}</span>
      <Button
        type="button"
        variant="secondary"
        className="forge-tenant-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="forge-tenant-switcher__value">
          {active?.displayName ?? "Select customer"}
        </span>
        <span aria-hidden>▾</span>
      </Button>
      {open ? (
        <div className="forge-tenant-switcher__popover" role="listbox" aria-label={label}>
          <input
            ref={inputRef}
            className="forge-input forge-tenant-switcher__search"
            type="search"
            placeholder="Search customers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
          <ul className="forge-tenant-switcher__list">
            {filtered.length === 0 ? (
              <li className="forge-tenant-switcher__empty">No matches</li>
            ) : (
              filtered.map((t) => {
                const selected = t.tenantId === activeTenantId;
                return (
                  <li key={t.tenantId}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? "forge-tenant-switcher__option forge-tenant-switcher__option--selected"
                          : "forge-tenant-switcher__option"
                      }
                      onClick={() => {
                        onSelect(t.tenantId);
                        setOpen(false);
                      }}
                    >
                      {t.displayName}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ForgeUserMenu({
  label,
  onSignOut,
  detail,
}: {
  label: string;
  onSignOut?: () => void;
  detail?: ReactNode;
}) {
  return (
    <div className="forge-topbar__actions" style={{ gap: "0.75rem" }}>
      <span className="forge-topbar__meta">{label}</span>
      {detail}
      {onSignOut ? (
        <Button type="button" variant="outline" onClick={onSignOut}>
          Sign out
        </Button>
      ) : null}
    </div>
  );
}

export function ForgeNotificationMenu({
  count = 0,
  label = "Notifications",
  disabledReason,
  items = [],
  emptyLabel = "No notifications",
}: {
  count?: number;
  label?: string;
  disabledReason?: string;
  items?: Array<{ id: string; title: string; href?: string; meta?: string }>;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const connected = !disabledReason;
  const badge = count > 0 ? count : items.length;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <Button
        type="button"
        variant="secondary"
        aria-label={label}
        aria-expanded={open}
        title={disabledReason ?? label}
        disabled={!connected}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        {badge > 0 ? ` (${badge})` : ""}
      </Button>
      {connected && open ? (
        <div
          role="menu"
          aria-label={label}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 0.35rem)",
            zIndex: 40,
            minWidth: "18rem",
            maxWidth: "24rem",
            padding: "0.65rem 0.75rem",
            borderRadius: "0.55rem",
            border: "1px solid var(--forge-color-border, #d0d7de)",
            background: "var(--forge-color-surface, #fff)",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
          }}
        >
          {items.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.75 }}>{emptyLabel}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.55rem" }}>
              {items.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <a href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                      <strong style={{ display: "block" }}>{item.title}</strong>
                      {item.meta ? (
                        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{item.meta}</span>
                      ) : null}
                    </a>
                  ) : (
                    <>
                      <strong style={{ display: "block" }}>{item.title}</strong>
                      {item.meta ? (
                        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{item.meta}</span>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ForgeProductSwitcher({
  products,
  activeProductId,
  onSelect,
}: {
  products: Array<{ id: string; label: string }>;
  activeProductId?: string | null;
  onSelect: (productId: string) => void;
}) {
  if (products.length === 0) return null;
  return (
    <label className="forge-topbar__meta" style={{ display: "inline-flex", gap: "0.5rem" }}>
      <span>Product</span>
      <select
        className="forge-select"
        aria-label="Switch product"
        value={activeProductId ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        style={{ minWidth: "10rem", minHeight: "2.5rem" }}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
