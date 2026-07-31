"use client";

import { useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import {
  RMS_FX_FEATURE_FLAGS,
  resolveRmsFxPresentationFlags,
  type RmsFxPresentationFlags,
} from "./rms-fx-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** FX presentation flags — default off; fail safe to legacy. */
export function useRmsFxFlags(): RmsFxPresentationFlags & { loading: boolean } {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([
    RMS_FX_FEATURE_FLAGS.shell,
    RMS_FX_FEATURE_FLAGS.navigation,
  ]);

  const resolved = useMemo(
    () =>
      resolveRmsFxPresentationFlags({
        apiFlags: flags,
        isPlatformAdmin: Boolean(me?.isPlatformAdmin),
        envShell: process.env.NEXT_PUBLIC_FX_RMS_SHELL_ENABLED,
        envNav: process.env.NEXT_PUBLIC_FX_RMS_NAVIGATION_ENABLED,
        sessionShell: readSessionFlag(RMS_FX_FEATURE_FLAGS.shell),
        sessionNav: readSessionFlag(RMS_FX_FEATURE_FLAGS.navigation),
      }),
    [flags, me?.isPlatformAdmin],
  );

  return { ...resolved, loading: authLoading || flagsLoading };
}
