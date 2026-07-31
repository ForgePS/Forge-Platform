"use client";

import type { ReactNode } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FEATURE_FLAGS } from "@/lib/constants";
import styles from "../app/page.module.css";

export function FeatureGate({
  flag,
  children,
  fallback,
  title = "Feature unavailable",
}: {
  flag: keyof typeof RMS_FEATURE_FLAGS;
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
}) {
  const { me, loading: authLoading } = useAuth();
  const flagKey = RMS_FEATURE_FLAGS[flag];
  const { flags, loading: flagsLoading, error } = useFeatureFlags([flagKey]);

  if (authLoading || flagsLoading) {
    return (
      <section className={styles.page}>
        <p className={styles.muted}>Checking access…</p>
      </section>
    );
  }

  if (!me) {
    return (
      <section className={styles.page}>
        <h1>{title}</h1>
        <p className={styles.error}>Sign in and select a tenant to continue.</p>
      </section>
    );
  }

  if (!flags[flagKey]) {
    return (
      fallback ?? (
        <section className={styles.page}>
          <h1>{title}</h1>
          <p className={styles.error}>
            This capability is not enabled for your tenant ({flagKey}).
            {error ? ` ${error}` : ""}
          </p>
        </section>
      )
    );
  }

  return <>{children}</>;
}
