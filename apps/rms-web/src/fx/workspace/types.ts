import type { ComponentType, ReactNode } from "react";

export type WorkspaceRecordType = "incident" | string;

export type WorkspaceTabDefinition = {
  id: string;
  label: string;
  /** Product capability flag key (RMS_FEATURE_FLAGS), if any */
  featureFlag?: string;
  /** Permission codes required to show the tab (all must pass when provided) */
  permissions?: string[];
};

export type WorkspaceSummaryItem = {
  id: string;
  label: string;
  value: string;
};

export type WorkspaceTimelineItem = {
  id: string;
  at: string;
  label: string;
  detail?: string;
  actor?: string;
};

export type WorkspaceRelatedItem = {
  id: string;
  label: string;
  href?: string;
  meta?: string;
};

export type WorkspaceNoteItem = {
  id: string;
  body: string;
  author?: string;
  at: string;
};

export type WorkspaceAttachmentItem = {
  id: string;
  name: string;
  href?: string;
  meta?: string;
};

export type WorkspaceAuditItem = {
  id: string;
  at: string;
  action: string;
  actor?: string;
  record?: string;
};

export type WorkspaceAction = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

/** Typed adapters — products supply existing data only. */
export type WorkspaceSummaryAdapter<TContext> = (ctx: TContext) => WorkspaceSummaryItem[];
export type WorkspaceTimelineAdapter<TContext> = (ctx: TContext) => WorkspaceTimelineItem[];
export type WorkspaceAttachmentsAdapter<TContext> = (ctx: TContext) => WorkspaceAttachmentItem[];
export type WorkspaceNotesAdapter<TContext> = (ctx: TContext) => WorkspaceNoteItem[];
export type WorkspaceRelatedAdapter<TContext> = (ctx: TContext) => WorkspaceRelatedItem[];
export type WorkspaceAuditAdapter<TContext> = (ctx: TContext) => WorkspaceAuditItem[];

export type WorkspaceDefinition = {
  id: string;
  recordType: WorkspaceRecordType;
  title: string;
  description?: string;
  icon?: string;
  /** FX presentation flag that gates this workspace chrome */
  featureFlag: string;
  permissions?: string[];
  /** Static fallback tabs; products may override from live navigation */
  supportedTabs: WorkspaceTabDefinition[];
  Layout: ComponentType<WorkspaceLayoutProps>;
};

export type WorkspaceLayoutProps = {
  recordId: string;
  title: string;
  status: string;
  activeTab: string;
  tabs: WorkspaceTabDefinition[];
  onTabChange: (tabId: string) => void;
  breadcrumbItems?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  summary?: WorkspaceSummaryItem[];
  timeline?: WorkspaceTimelineItem[];
  related?: WorkspaceRelatedItem[];
  notes?: WorkspaceNoteItem[];
  attachments?: WorkspaceAttachmentItem[];
  audit?: WorkspaceAuditItem[];
  sidebarExtras?: ReactNode;
  children: ReactNode;
};
