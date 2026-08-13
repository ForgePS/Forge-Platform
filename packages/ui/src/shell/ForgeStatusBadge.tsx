const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  DISABLED: "Disabled",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  GRACE: "Grace",
  READY: "Ready",
  ENTITLED: "Active",
  MIGRATION_IN_PROGRESS: "Migration in Progress",
  NEEDS_ATTENTION: "Needs Attention",
  COMING_SOON: "Coming Soon",
  LEGACY_FIREBASE: "Legacy Firebase",
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
};

const TONE_BY_STATUS: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  ACTIVE: "success",
  ENTITLED: "success",
  READY: "success",
  CLOSED: "success",
  INACTIVE: "neutral",
  DISABLED: "neutral",
  PENDING: "warning",
  GRACE: "warning",
  MIGRATION_IN_PROGRESS: "warning",
  NEEDS_ATTENTION: "warning",
  COMING_SOON: "info",
  SUSPENDED: "danger",
  OPEN: "warning",
  DRAFT: "neutral",
  LEGACY_FIREBASE: "info",
};

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const key = status.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return status
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ForgeStatusBadge({
  status,
  label,
}: {
  status: string | null | undefined;
  label?: string;
}) {
  const key = (status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  const tone = TONE_BY_STATUS[key] ?? "neutral";
  return (
    <span className={`forge-status-badge forge-status-badge--${tone}`} data-status={key || undefined}>
      {label ?? humanizeStatus(status)}
    </span>
  );
}
