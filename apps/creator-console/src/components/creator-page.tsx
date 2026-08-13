"use client";

import type { ReactNode } from "react";
import {
  EmptyState,
  ErrorState,
  ForgePageContainer,
  ForgePageHeader,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeToolbar,
} from "@forge/ui";

export {
  EmptyState,
  ErrorState,
  ForgePageContainer,
  ForgePageHeader,
  ForgePageSection,
  ForgeSkeleton,
  ForgeStatusBadge,
  ForgeToolbar,
};

/** Standard Creator page chrome — Wave B contract wrapper. */
export function CreatorPage({
  title,
  subtitle,
  actions,
  children,
  width = "default",
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  width?: "default" | "form" | "wide";
}) {
  const stringSubtitle = typeof subtitle === "string" ? subtitle : undefined;
  return (
    <ForgePageContainer width={width}>
      <ForgePageHeader
        title={title}
        {...(stringSubtitle !== undefined ? { subtitle: stringSubtitle } : {})}
        {...(actions !== undefined ? { actions } : {})}
      />
      {subtitle != null && typeof subtitle !== "string" ? (
        <p className="forge-page-header__subtitle">{subtitle}</p>
      ) : null}
      {children}
    </ForgePageContainer>
  );
}

export function CreatorLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <ForgePageContainer>
      <ForgeSkeleton height="1.5rem" width="12rem" />
      <p className="forge-page-header__subtitle" style={{ marginTop: "0.75rem" }}>
        {label}
      </p>
    </ForgePageContainer>
  );
}
