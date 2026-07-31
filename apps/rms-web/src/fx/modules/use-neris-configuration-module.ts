"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_FORMS_FLAG, resolveRmsFxFormsFlag } from "@/fx/forms/forms-flags";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveNerisConfigurationModulePresentation,
  resolveRmsFxModuleFlag,
  type NerisConfigurationModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxNerisConfigurationModule(): NerisConfigurationModulePresentation & {
  loading: boolean;
} {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_MODULE_FLAGS.nerisConfiguration,
    RMS_FX_FORMS_FLAG,
  ]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.nerisConfiguration],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_NERIS_CONFIGURATION_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.nerisConfiguration),
    });
    const formsEnabled = resolveRmsFxFormsFlag({
      apiEnabled: flags[RMS_FX_FORMS_FLAG],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_FORMS_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_FORMS_FLAG),
    });

    return resolveNerisConfigurationModulePresentation({
      moduleEnabled,
      formsEnabled,
    });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "nerisConfiguration",
      surface: "forms",
      mode: presentation.forms,
      reason: presentation.reasons.forms,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
