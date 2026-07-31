"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_FORMS_FLAG, resolveRmsFxFormsFlag } from "@/fx/forms/forms-flags";
import { RMS_FX_TABLES_FLAG, resolveRmsFxTablesFlag } from "@/fx/tables/tables-flags";
import { RMS_FX_WORKSPACE_FLAG, resolveRmsFxWorkspaceFlag } from "@/fx/workspace/workspace-flags";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveIncidentModulePresentation,
  resolveRmsFxModuleFlag,
  type IncidentModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxIncidentModule(): IncidentModulePresentation & { loading: boolean } {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_MODULE_FLAGS.incidents,
    RMS_FX_TABLES_FLAG,
    RMS_FX_FORMS_FLAG,
    RMS_FX_WORKSPACE_FLAG,
  ]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.incidents],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_INCIDENTS_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.incidents),
    });
    const tablesEnabled = resolveRmsFxTablesFlag({
      apiEnabled: flags[RMS_FX_TABLES_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_TABLES_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_TABLES_FLAG),
    });
    const formsEnabled = resolveRmsFxFormsFlag({
      apiEnabled: flags[RMS_FX_FORMS_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_FORMS_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_FORMS_FLAG),
    });
    const workspaceEnabled = resolveRmsFxWorkspaceFlag({
      apiEnabled: flags[RMS_FX_WORKSPACE_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_WORKSPACE_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_WORKSPACE_FLAG),
    });

    return resolveIncidentModulePresentation({
      moduleEnabled,
      tablesEnabled,
      formsEnabled,
      workspaceEnabled,
    });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "incidents",
      surface: "list",
      mode: presentation.list,
      reason: presentation.reasons.list,
    });
    logFxModulePresentation({
      module: "incidents",
      surface: "newForm",
      mode: presentation.newForm,
      reason: presentation.reasons.newForm,
    });
    logFxModulePresentation({
      module: "incidents",
      surface: "workspace",
      mode: presentation.workspace,
      reason: presentation.reasons.workspace,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
