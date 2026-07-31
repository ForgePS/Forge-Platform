"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_TABLES_FLAG, resolveRmsFxTablesFlag } from "@/fx/tables/tables-flags";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveAdministrationModulePresentation,
  resolveRmsFxModuleFlag,
  type AdministrationModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxAdministrationModule(): AdministrationModulePresentation & {
  loading: boolean;
} {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_MODULE_FLAGS.administration,
    RMS_FX_TABLES_FLAG,
  ]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.administration],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_ADMINISTRATION_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.administration),
    });
    const tablesEnabled = resolveRmsFxTablesFlag({
      apiEnabled: flags[RMS_FX_TABLES_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_TABLES_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_TABLES_FLAG),
    });

    return resolveAdministrationModulePresentation({
      moduleEnabled,
      tablesEnabled,
    });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "administration",
      surface: "selectTenant",
      mode: presentation.selectTenant,
      reason: presentation.reasons.selectTenant,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
