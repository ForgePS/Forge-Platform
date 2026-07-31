"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_FORMS_FLAG, resolveRmsFxFormsFlag } from "@/fx/forms/forms-flags";
import { RMS_FX_TABLES_FLAG, resolveRmsFxTablesFlag } from "@/fx/tables/tables-flags";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveIncidentReviewModulePresentation,
  resolveRmsFxModuleFlag,
  type IncidentReviewModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxIncidentReviewModule(): IncidentReviewModulePresentation & {
  loading: boolean;
} {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_MODULE_FLAGS.incidentReview,
    RMS_FX_TABLES_FLAG,
    RMS_FX_FORMS_FLAG,
  ]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.incidentReview],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_INCIDENT_REVIEW_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.incidentReview),
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

    return resolveIncidentReviewModulePresentation({
      moduleEnabled,
      tablesEnabled,
      formsEnabled,
    });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "incidentReview",
      surface: "queue",
      mode: presentation.queue,
      reason: presentation.reasons.queue,
    });
    logFxModulePresentation({
      module: "incidentReview",
      surface: "detailForms",
      mode: presentation.detailForms,
      reason: presentation.reasons.detailForms,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
