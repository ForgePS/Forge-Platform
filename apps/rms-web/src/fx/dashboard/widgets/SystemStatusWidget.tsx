"use client";

import Link from "next/link";
import type { DashboardWidgetComponentProps } from "../types";

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "local";

/** Non-sensitive environment pointer — no infrastructure secrets. */
export function SystemStatusWidget(_props: DashboardWidgetComponentProps) {
  return (
    <div className="rms-fx-widget__meta">
      <div className="rms-fx-widget__meta-row">
        <span>Product</span>
        <span>Forge RMS</span>
      </div>
      <div className="rms-fx-widget__meta-row">
        <span>Environment</span>
        <span>{appEnv}</span>
      </div>
      <p style={{ marginBottom: 0 }}>
        <Link href="/health/">Open health probe</Link>
      </p>
    </div>
  );
}
