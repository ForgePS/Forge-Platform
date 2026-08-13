import type { ForgeNavigationGroup } from "@forge/design-system";

/**
 * Creator Console mission IA (CREATOR-UX-S1B).
 * Item `permission` / `anyOfPermissions` filter UX only — API auth is authoritative.
 * Routes stay backend-aligned; Customers uses /tenants with /customers aliases.
 */
export const CREATOR_NAV_GROUPS: ForgeNavigationGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        route: "/",
        anyOfPermissions: ["platform.tenant.read", "platform.analytics.read"],
      },
      {
        id: "analytics",
        label: "Analytics",
        route: "/analytics",
        permission: "platform.analytics.read",
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      { id: "customers-list", label: "All customers", route: "/customers", permission: "platform.tenant.read" },
      {
        id: "invitations",
        label: "Invitations",
        route: "/invitations",
        permission: "platform.invitation.read",
      },
      {
        id: "onboarding",
        label: "Onboarding",
        route: "/onboarding",
        permission: "platform.onboarding.manage",
      },
      {
        id: "memberships",
        label: "Memberships",
        route: "/memberships",
        permission: "platform.membership.read",
      },
      {
        id: "organizations",
        label: "Organizations",
        route: "/organizations",
        permission: "platform.organization.read",
      },
      { id: "persons", label: "Persons", route: "/persons", permission: "platform.person.read" },
      { id: "users", label: "Users", route: "/users", permission: "platform.user.invite" },
    ],
  },
  {
    id: "products",
    label: "Products",
    items: [
      {
        id: "products-list",
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
        id: "entitlements",
        label: "Entitlements",
        route: "/entitlements",
        permission: "platform.entitlement.manage",
      },
      {
        id: "features",
        label: "Feature flags",
        route: "/features",
        permission: "platform.feature.manage",
      },
      {
        id: "plans",
        label: "Plans",
        route: "/plans",
        permission: "platform.entitlement.manage",
      },
      {
        id: "subscriptions",
        label: "Subscriptions",
        route: "/subscriptions",
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
    ],
  },
  {
    id: "migration",
    label: "Migration",
    items: [
      {
        id: "migrations",
        label: "Migration Center",
        route: "/migrations",
        anyOfPermissions: ["platform.tenant.read", "import.view"],
      },
      { id: "import-center", label: "Import Center", route: "/imports", permission: "import.view" },
      { id: "jobs", label: "Jobs", route: "/jobs", permission: "platform.jobs.read" },
      {
        id: "exports",
        label: "Data export",
        route: "/exports",
        permission: "tenant.export.create",
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        id: "studio-home",
        label: "Configuration studio",
        route: "/studio",
        permission: "platform.configuration.update",
      },
      {
        id: "studio-tenant",
        label: "Tenant profile",
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
      {
        id: "neris-packages",
        label: "NERIS packages",
        route: "/neris/packages",
        permission: "platform.neris.schema.read",
      },
      {
        id: "neris-modules",
        label: "NERIS modules",
        route: "/neris/modules",
        permission: "platform.neris.schema.read",
      },
      { id: "ai-overview", label: "AI management", route: "/ai" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      {
        id: "security-hub",
        label: "Security hub",
        route: "/security",
        anyOfPermissions: ["platform.audit.read", "platform.role.assign", "platform.permission.read"],
      },
      { id: "roles", label: "Roles", route: "/roles", permission: "platform.role.assign" },
      {
        id: "permissions",
        label: "Permissions",
        route: "/permissions",
        permission: "platform.permission.read",
      },
      { id: "audit", label: "Audit log", route: "/audit", permission: "platform.audit.read" },
      { id: "login", label: "Login", route: "/login" },
      { id: "select-tenant", label: "Select tenant", route: "/select-tenant" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        id: "ops-health",
        label: "Health",
        route: "/operations/health",
        permission: "platform.tenant.read",
      },
      {
        id: "ops-alerts",
        label: "Alerts",
        route: "/operations/alerts",
        permission: "platform.tenant.read",
      },
      { id: "health", label: "System health", route: "/health", permission: "platform.tenant.read" },
      { id: "system", label: "System", route: "/system", permission: "platform.tenant.read" },
    ],
  },
  {
    id: "system-nav",
    label: "System",
    items: [
      {
        id: "settings",
        label: "Settings",
        route: "/settings",
        permission: "platform.configuration.update",
      },
      { id: "profile", label: "Profile", route: "/profile" },
      {
        id: "notifications",
        label: "Notifications",
        route: "/notifications",
      },
    ],
  },
];
