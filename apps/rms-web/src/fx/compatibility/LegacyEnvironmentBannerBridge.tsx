"use client";

import { EnvironmentBanner } from "@forge/ui";

/** Bridge to existing @forge/ui EnvironmentBanner until fully retired. */
export function LegacyEnvironmentBannerBridge({ environment }: { environment: string }) {
  return <EnvironmentBanner environment={environment} />;
}
