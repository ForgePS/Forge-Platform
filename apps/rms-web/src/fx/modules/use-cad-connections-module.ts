"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_FORMS_FLAG, resolveRmsFxFormsFlag } from "@/fx/forms/forms-flags";
import { RMS_FX_TABLES_FLAG, resolveRmsFxTablesFlag } from "@/fx/tables/tables-flags";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveCadConnectionsModulePresentation,
  resolveRmsFxModuleFlag,
  type CadConnectionsModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxCadConnectionsModule(): CadConnectionsModulePresentation & {
  loading: boolean;
} {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_MODULE_FLAGS.cadConnections,
    RMS_FX_FORMS_FLAG,
    RMS_FX_TABLES_FLAG,
  ]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.cadConnections],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_CAD_CONNECTIONS_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.cadConnections),
    });
    const formsEnabled = resolveRmsFxFormsFlag({
      apiEnabled: flags[RMS_FX_FORMS_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_FORMS_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_FORMS_FLAG),
    });
    const tablesEnabled = resolveRmsFxTablesFlag({
      apiEnabled: flags[RMS_FX_TABLES_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_TABLES_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_TABLES_FLAG),
    });

    return resolveCadConnectionsModulePresentation({
      moduleEnabled,
      formsEnabled,
      tablesEnabled,
    });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "cadConnections",
      surface: "createForm",
      mode: presentation.createForm,
      reason: presentation.reasons.createForm,
    });
    logFxModulePresentation({
      module: "cadConnections",
      surface: "list",
      mode: presentation.list,
      reason: presentation.reasons.list,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
