import type { ReactNode } from "react";
import { Button } from "../primitives.js";
import type { ForgeLinkRender, ForgeShellFacility, ForgeShellTenant } from "./types.js";

export function ForgeTenantSwitcher({
  tenants,
  activeTenantId,
  onSelect,
  disabled,
  state = "ready",
}: {
  tenants: ForgeShellTenant[];
  activeTenantId?: string | null;
  onSelect: (tenantId: string) => void;
  disabled?: boolean;
  state?: "ready" | "loading" | "empty" | "error" | "unauthorized" | "disabled_entitlement";
}) {
  if (state === "loading") {
    return <span className="forge-topbar__meta">Loading tenants…</span>;
  }
  if (state === "error") {
    return <span className="forge-topbar__meta">Tenant list unavailable</span>;
  }
  if (state === "unauthorized" || state === "disabled_entitlement") {
    return <span className="forge-topbar__meta">Tenant switch unavailable</span>;
  }
  const selectable = tenants.filter((t) => t.selectable !== false);
  if (selectable.length === 0 || state === "empty") {
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

export type ForgeUserMenuItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
};

export function ForgeUserMenu({
  label,
  onSignOut,
  detail,
  items = [],
  renderLink,
}: {
  label: string;
  onSignOut?: () => void;
  detail?: ReactNode;
  items?: ForgeUserMenuItem[];
  renderLink?: ForgeLinkRender;
}) {
  return (
    <div className="forge-topbar__actions" style={{ gap: "0.75rem" }}>
      <span className="forge-topbar__meta">{label}</span>
      {items.map((item) => {
        if (item.disabled) {
          return (
            <Button key={item.label} type="button" variant="secondary" disabled title={item.title ?? item.label}>
              {item.label}
            </Button>
          );
        }
        if (item.href && renderLink) {
          return (
            <span key={item.label} className="forge-topbar__meta">
              {renderLink({
                href: item.href,
                children: item.label,
                ...(item.onClick ? { onClick: item.onClick } : {}),
              })}
            </span>
          );
        }
        if (item.href) {
          return (
            <a key={item.label} href={item.href} className="forge-topbar__meta" onClick={item.onClick}>
              {item.label}
            </a>
          );
        }
        return (
          <Button key={item.label} type="button" variant="outline" onClick={item.onClick} title={item.title}>
            {item.label}
          </Button>
        );
      })}
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
  disabled = true,
}: {
  count?: number;
  label?: string;
  disabledReason?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      title={disabledReason}
      disabled={disabled}
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
  disabled,
  state = "ready",
}: {
  products: Array<{ id: string; name: string; entitlementDisabled?: boolean }>;
  activeProductId?: string;
  onSelect?: (id: string) => void;
  disabled?: boolean;
  state?: "ready" | "loading" | "empty" | "error" | "unauthorized" | "disabled_entitlement";
}) {
  if (state === "loading") {
    return <span className="forge-topbar__meta">Loading products…</span>;
  }
  if (state === "error") {
    return <span className="forge-topbar__meta">Products unavailable</span>;
  }
  if (state === "unauthorized") {
    return <span className="forge-topbar__meta">Product switch unauthorized</span>;
  }
  if (state === "disabled_entitlement" || products.every((p) => p.entitlementDisabled)) {
    return <span className="forge-topbar__meta">No entitled products</span>;
  }
  if (products.length === 0 || state === "empty") return null;
  return (
    <label className="forge-topbar__meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
      <span>Product</span>
      <select
        className="forge-select"
        aria-label="Switch product"
        value={activeProductId ?? products[0]?.id}
        disabled={disabled || !onSelect}
        onChange={(e) => onSelect?.(e.target.value)}
        style={{ minWidth: "9rem", minHeight: "2.5rem" }}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id} disabled={p.entitlementDisabled}>
            {p.name}
            {p.entitlementDisabled ? " (not entitled)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ForgeFacilitySelector({
  facilities,
  activeFacilityId,
  onSelect,
  disabled,
  state = "ready",
}: {
  facilities: ForgeShellFacility[];
  activeFacilityId?: string | null;
  onSelect?: (facilityId: string) => void;
  disabled?: boolean;
  state?: "ready" | "loading" | "empty" | "error" | "unauthorized" | "disabled_entitlement";
}) {
  if (state === "loading") {
    return <span className="forge-topbar__meta">Loading facilities…</span>;
  }
  if (state === "error") {
    return <span className="forge-topbar__meta">Facilities unavailable</span>;
  }
  if (state === "unauthorized" || state === "disabled_entitlement") {
    return <span className="forge-topbar__meta">Facility selector unavailable</span>;
  }
  if (facilities.length === 0 || state === "empty") {
    return <span className="forge-topbar__meta">No facilities</span>;
  }
  return (
    <label className="forge-topbar__meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
      <span>Facility</span>
      <select
        className="forge-select"
        aria-label="Select facility"
        disabled={disabled || !onSelect}
        value={activeFacilityId ?? facilities[0]?.id ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect?.(e.target.value);
        }}
        style={{ minWidth: "9rem", minHeight: "2.5rem" }}
      >
        {facilities.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ForgeSearchTrigger({
  onTrigger,
  disabled = true,
  disabledReason = "Search not connected (MK-S18)",
  label = "Search",
}: {
  onTrigger?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      title={disabledReason}
      disabled={disabled}
      onClick={onTrigger}
    >
      {label}
    </Button>
  );
}

export function ForgeHelpMenu({
  href,
  onClick,
  disabled = false,
  disabledReason,
  label = "Help",
  renderLink,
}: {
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
  renderLink?: ForgeLinkRender;
}) {
  if (disabled) {
    return (
      <Button type="button" variant="secondary" aria-label={label} title={disabledReason ?? label} disabled>
        {label}
      </Button>
    );
  }
  if (href && renderLink) {
    return (
      <span className="forge-topbar__meta">
        {renderLink({ href, children: label, ...(onClick ? { onClick } : {}) })}
      </span>
    );
  }
  if (href) {
    return (
      <a href={href} className="forge-topbar__meta" onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Button type="button" variant="secondary" aria-label={label} onClick={onClick}>
      {label}
    </Button>
  );
}
