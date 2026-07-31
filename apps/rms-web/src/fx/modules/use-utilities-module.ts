"use client";

import { useEffect, useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { logFxModulePresentation } from "./module-diagnostics";
import {
  RMS_FX_MODULE_FLAGS,
  resolveRmsFxModuleFlag,
  resolveUtilitiesModulePresentation,
  type UtilitiesModulePresentation,
} from "./module-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxUtilitiesModule(): UtilitiesModulePresentation & { loading: boolean } {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([RMS_FX_MODULE_FLAGS.utilities]);

  const isPlatformAdmin = Boolean(me?.isPlatformAdmin);

  const presentation = useMemo(() => {
    const moduleEnabled = resolveRmsFxModuleFlag({
      apiEnabled: flags[RMS_FX_MODULE_FLAGS.utilities],
      isPlatformAdmin,
      envOverride: process.env.NEXT_PUBLIC_FX_RMS_MODULE_UTILITIES_ENABLED,
      sessionOverride: readSessionFlag(RMS_FX_MODULE_FLAGS.utilities),
    });

    return resolveUtilitiesModulePresentation({ moduleEnabled });
  }, [flags, isPlatformAdmin]);

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    logFxModulePresentation({
      module: "utilities",
      surface: "health",
      mode: presentation.health,
      reason: presentation.reasons.health,
    });
  }, [authLoading, flagsLoading, presentation]);

  return { ...presentation, loading: authLoading || flagsLoading };
}
