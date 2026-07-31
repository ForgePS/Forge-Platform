"use client";

import type { ReactNode } from "react";
import { FxAlert, FxEmptyState } from "@forge/fx-ui";

/** Optional FX chrome for feature-disabled states — does not change FeatureGate logic. */
export function FeatureGateChromeBridge({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <FxAlert tone="warning" title={title}>
        {description}
      </FxAlert>
      {children ?? <FxEmptyState title={title} description={description} />}
    </div>
  );
}
