"use client";

import { useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_FORMS_FLAG, resolveRmsFxFormsFlag } from "./forms-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxFormsFlag(): { enabled: boolean; loading: boolean } {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([RMS_FX_FORMS_FLAG]);

  const enabled = useMemo(
    () =>
      resolveRmsFxFormsFlag({
        apiEnabled: flags[RMS_FX_FORMS_FLAG],
        isPlatformAdmin: Boolean(me?.isPlatformAdmin),
        envOverride: process.env.NEXT_PUBLIC_FX_RMS_FORMS_ENABLED,
        sessionOverride: readSessionFlag(RMS_FX_FORMS_FLAG),
      }),
    [flags, me?.isPlatformAdmin],
  );

  return { enabled, loading: authLoading || flagsLoading };
}
