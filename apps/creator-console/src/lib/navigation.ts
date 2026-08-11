import type { ForgeNavigationGroup } from "@forge/design-system";

/**
 * Creator Console navigation (MK-S11 control plane first).
 * Item `permission` / `anyOfPermissions` filter UX only — API auth is authoritative.
 */
export const CREATOR_NAV_GROUPS: ForgeNavigationGroup[] = [
  {
    id: "control-plane",
    label: "Control plane",
    items: [
      { id: "overview", label: "Overview", route: "/", anyOfPermissions: ["platform.tenant.read", "platform.analytics.read"] },
      {
        id: "analytics",
        label: "Analytics",
        route: "/analytics",
        permission: "platform.analytics.read",
      },
      { id: "tenants", label: "Tenants", route: "/tenants", permission: "platform.tenant.read" },
      { id: "users", label: "Users", route: "/users", permission: "platform.user.invite" },
      {
        id: "products",
        label: "Products",
        route: "/products",
        permission: "platform.entitlement.manage",
      },
      {
        id: "modules",
        label: "Modules",
        route: "/modules",
        permission: "platform.entitlement.manage",
      },
      {
        id: "plans",
        label: "Plans",
        route: "/plans",
        permission: "platform.entitlement.manage",
      },
      {
        id: "contracts",
        label: "Contracts",
        route: "/contracts",
        anyOfPermissions: ["platform.entitlement.manage", "tenant.billing.read"],
      },
      {
        id: "billing",
        label: "Billing",
        route: "/billing",
        anyOfPermissions: ["platform.entitlement.manage", "tenant.billing.read"],
      },
      {
        id: "features",
        label: "Feature Flags",
        route: "/features",
        permission: "platform.feature.manage",
      },
      { id: "audit", label: "Audit", route: "/audit", permission: "platform.audit.read" },
      { id: "system", label: "System", route: "/system", permission: "platform.tenant.read" },
    ],
  },
  {
    id: "access",
    label: "Access",
    items: [
      { id: "login", label: "Login", route: "/login" },
      { id: "select-tenant", label: "Select tenant", route: "/select-tenant" },
      {
        id: "invitations",
        label: "Invitations",
        route: "/invitations",
        permission: "platform.invitation.read",
      },
      {
        id: "memberships",
        label: "Memberships",
        route: "/memberships",
        permission: "platform.membership.read",
      },
      {
        id: "onboarding",
        label: "Onboarding",
        route: "/onboarding",
        permission: "platform.onboarding.manage",
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        route: "/subscriptions",
        permission: "platform.entitlement.manage",
      },
      {
        id: "entitlements",
        label: "Entitlements",
        route: "/entitlements",
        permission: "platform.entitlement.manage",
      },
    ],
  },
  {
    id: "directory",
    label: "Directory",
    items: [
      {
        id: "organizations",
        label: "Organizations",
        route: "/organizations",
        permission: "platform.organization.read",
      },
      { id: "persons", label: "Persons", route: "/persons", permission: "platform.person.read" },
      { id: "roles", label: "Roles", route: "/roles", permission: "platform.role.assign" },
      {
        id: "permissions",
        label: "Permissions",
        route: "/permissions",
        permission: "platform.permission.read",
      },
    ],
  },
  {
    id: "studio",
    label: "Configuration Studio",
    items: [
      {
        id: "studio-home",
        label: "Studio home",
        route: "/studio",
        permission: "platform.configuration.update",
      },
      {
        id: "studio-tenant",
        label: "Tenant Profile",
        route: "/studio/tenant-profile",
        permission: "platform.configuration.update",
      },
      {
        id: "studio-branding",
        label: "Branding",
        route: "/studio/branding",
        permission: "platform.configuration.update",
      },
      {
        id: "studio-facilities",
        label: "Facilities",
        route: "/studio/facilities",
        permission: "platform.configuration.update",
      },
    ],
  },
  {
    id: "neris",
    label: "NERIS Schema",
    items: [
      {
        id: "neris-packages",
        label: "Packages",
        route: "/neris/packages",
        permission: "platform.neris.schema.read",
      },
      {
        id: "neris-modules",
        label: "Modules",
        route: "/neris/modules",
        permission: "platform.neris.schema.read",
      },
    ],
  },
  {
    id: "ai",
    label: "AI Management",
    items: [{ id: "ai-overview", label: "Overview", route: "/ai" }],
  },
  {
    id: "imports",
    label: "Import Center",
    items: [
      { id: "import-center", label: "Import Center", route: "/imports", permission: "import.view" },
      { id: "jobs", label: "Jobs", route: "/jobs", permission: "platform.jobs.read" },
      {
        id: "exports",
        label: "Data Export",
        route: "/exports",
        permission: "tenant.export.create",
      },
    ],
  },
];
