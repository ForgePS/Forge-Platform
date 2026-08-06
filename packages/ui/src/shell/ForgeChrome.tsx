import type { ReactNode } from "react";
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
    <label className="forge-topbar__meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
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
  disabledReason = "Notification center not connected",
}: {
  count?: number;
  label?: string;
  disabledReason?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      title={disabledReason}
      disabled
    >
      {label}
      {count > 0 ? ` (${count})` : ""}
    </Button>
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
    <label className="forge-topbar__meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
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
