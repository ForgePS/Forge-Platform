export {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  EnvironmentBanner,
  ErrorState,
  FixtureBanner,
  ForgeSkeleton,
  Input,
  LoadingIndicator,
  Modal,
  Radio,
  Select,
  Textarea,
} from "./primitives.js";

export { ForgeAppShell } from "./shell/ForgeAppShell.js";
export { ForgeSidebar } from "./shell/ForgeSidebar.js";
export { ForgeTopbar } from "./shell/ForgeTopbar.js";
export { ForgeBreadcrumbs } from "./shell/ForgeBreadcrumbs.js";
export { ForgePageHeader, ForgePageActions } from "./shell/ForgePageHeader.js";
export {
  ForgeNotificationMenu,
  ForgeProductSwitcher,
  ForgeTenantSwitcher,
  ForgeUserMenu,
} from "./shell/ForgeChrome.js";
export type { ForgeBreadcrumbItem } from "./shell/ForgeBreadcrumbs.js";
export type { ForgeLinkRender, ForgeShellTenant } from "./shell/types.js";
export { flattenNavItems, isNavActive } from "./shell/types.js";

export {
  ForgeMetricCard,
  ForgeMetricGrid,
  ForgeModuleCard,
  ForgeModuleGrid,
  ForgeStatusCard,
  ForgeStepper,
} from "./dashboard/ForgeDashboard.js";

export { ForgeDataTable } from "./table/ForgeDataTable.js";
export type { ForgeDataTableColumn } from "./table/ForgeDataTable.js";

export { Can, PermissionDenied } from "./permission/Can.js";
