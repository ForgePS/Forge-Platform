import { useState, type ReactNode } from "react";
import { Button } from "../primitives.js";
import type { ForgeShellTenant } from "./types.js";

export function ForgeTenantSwitcher({
  tenants,
  activeTenantId,
  onSelect,
  disabled,
}: {
  tenants: ForgeShellTenant[];
  activeTenantId?: string | null;
  onSelect: (tenantId: string) => void;
  disabled?: boolean;
}) {
  const selectable = tenants.filter((t) => t.selectable !== false);
  if (selectable.length === 0) {
    return <span className="forge-topbar__meta">No tenants</span>;
  }
  return (
    <label
      className="forge-topbar__meta"
      style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
    >
      <span>Tenant</span>
      <select
        className="forge-select"
        aria-label="Switch tenant"
        disabled={disabled}
        value={activeTenantId ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        style={{ minWidth: "10rem", minHeight: "2.5rem" }}
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
                      <strong style={{ display: "block", fontSize: "0.92rem" }}>{item.title}</strong>
                      {item.meta ? (
                        <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>{item.meta}</span>
                      ) : null}
                    </a>
                  ) : (
                    <>
                      <strong style={{ display: "block", fontSize: "0.92rem" }}>{item.title}</strong>
                      {item.meta ? (
                        <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>{item.meta}</span>
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
  products: Array<{ id: string; name: string }>;
  activeProductId?: string;
  onSelect?: (id: string) => void;
}) {
  if (products.length === 0) return null;
  return (
    <label
      className="forge-topbar__meta"
      style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}
    >
      <span>Product</span>
      <select
        className="forge-select"
        aria-label="Switch product"
        value={activeProductId ?? products[0]?.id}
        disabled={!onSelect}
        onChange={(e) => onSelect?.(e.target.value)}
        style={{ minWidth: "9rem", minHeight: "2.5rem" }}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
