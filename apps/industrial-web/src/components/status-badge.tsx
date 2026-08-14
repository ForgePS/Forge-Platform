"use client";

const TONE: Record<string, string> = {
  ACTIVE: "bg-label-success",
  OPEN: "bg-label-warning",
  DRAFT: "bg-label-secondary",
  IN_PROGRESS: "bg-label-info",
  PENDING_REVIEW: "bg-label-warning",
  COMPLETED: "bg-label-success",
  COMPLETE: "bg-label-success",
  CLOSED: "bg-label-secondary",
  OVERDUE: "bg-label-danger",
  EXPIRED: "bg-label-danger",
  INACTIVE: "bg-label-secondary",
  ARCHIVED: "bg-label-secondary",
  SUSPENDED: "bg-label-danger",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Active",
  OPEN: "Open",
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  PENDING_REVIEW: "Pending Review",
  COMPLETED: "Completed",
  COMPLETE: "Complete",
  CLOSED: "Closed",
  OVERDUE: "Overdue",
  EXPIRED: "Expired",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
  SUSPENDED: "Suspended",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const raw = String(status ?? "").trim();
  if (!raw) return <span className="badge bg-label-secondary">—</span>;
  const key = raw.toUpperCase().replace(/\s+/g, "_");
  const tone = TONE[key] ?? "bg-label-secondary";
  const label = LABELS[key] ?? raw.replace(/_/g, " ");
  return <span className={`badge ${tone}`}>{label}</span>;
}
