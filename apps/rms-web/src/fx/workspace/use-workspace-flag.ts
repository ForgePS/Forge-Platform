"use client";

import { useMemo } from "react";
import { useAuth, useFeatureFlags } from "@forge/web-kit";
import { RMS_FX_WORKSPACE_FLAG, resolveRmsFxWorkspaceFlag } from "./workspace-flags";

function readSessionFlag(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useRmsFxWorkspaceFlag(): { enabled: boolean; loading: boolean } {
  const { me, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = useFeatureFlags([RMS_FX_WORKSPACE_FLAG]);

  const enabled = useMemo(
    () =>
      resolveRmsFxWorkspaceFlag({
        apiEnabled: flags[RMS_FX_WORKSPACE_FLAG],
        isPlatformAdmin: Boolean(me?.isPlatformAdmin),
        envOverride: process.env.NEXT_PUBLIC_FX_RMS_WORKSPACE_ENABLED,
        sessionOverride: readSessionFlag(RMS_FX_WORKSPACE_FLAG),
      }),
    [flags, me?.isPlatformAdmin],
  );

  return { enabled, loading: authLoading || flagsLoading };
}
