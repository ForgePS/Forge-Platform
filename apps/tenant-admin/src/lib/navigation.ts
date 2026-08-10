import type { ForgeNavigationGroup } from "@forge/design-system";

export const TENANT_ADMIN_NAV_GROUPS: ForgeNavigationGroup[] = [
  {
    id: "billing",
    label: "Billing",
    items: [{ id: "billing-overview", label: "Billing overview", route: "/billing" }],
  },
  {
    id: "imports",
    label: "Import Center",
    items: [{ id: "import-center", label: "Import Center", route: "/imports" }],
  },
  {
    id: "studio",
    label: "Configuration Studio",
    items: [
      { id: "studio-home", label: "Studio home", route: "/studio" },
      { id: "studio-tenant", label: "Tenant Profile", route: "/studio/tenant-profile" },
      { id: "studio-org", label: "Org Profile", route: "/studio/organization-profile" },
      { id: "studio-branding", label: "Branding", route: "/studio/branding" },
      { id: "studio-navigation", label: "Navigation", route: "/studio/navigation" },
      { id: "studio-terminology", label: "Terminology", route: "/studio/terminology" },
      { id: "studio-dropdowns", label: "Dropdowns", route: "/studio/dropdowns" },
      {
        id: "studio-notification-templates",
        label: "Notification templates",
        route: "/studio/notification-templates",
      },
      { id: "studio-email-templates", label: "Email templates", route: "/studio/email-templates" },
      { id: "studio-business-hours", label: "Business hours", route: "/studio/business-hours" },
      { id: "studio-holiday-calendar", label: "Holiday calendar", route: "/studio/holiday-calendar" },
      { id: "studio-facilities", label: "Facilities", route: "/studio/facilities" },
      { id: "studio-locations", label: "Locations", route: "/studio/locations" },
      { id: "studio-roles", label: "Roles", route: "/studio/roles" },
    ],
  },
];
