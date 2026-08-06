"use client";

import { useEffect, useState } from "react";
import { apiGet, useAuth } from "@forge/web-kit";
import { OpsModuleWorkspace } from "@/components/ops-module-workspace";
import { SeasonalWorkforceWorkspace } from "@/components/seasonal-workforce-workspace";
import { isSeasonalLifecycleEnabled } from "@/lib/personnel-seasonal";

type Bootstrap = {
  industrialEnabled: boolean;
  flags?: Record<string, boolean>;
  modules: Array<{ code: string; awsEnabled: boolean }>;
};

type PersonnelView = "roster" | "seasonal";

export function PersonnelWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    permissions.has("industrial.personnel.view") || permissions.has("industrial.admin");

  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<PersonnelView>("roster");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const boot = await apiGet<Bootstrap>("/api/v1/industrial/bootstrap");
        if (!cancelled) setBootstrap(boot);
      } catch {
        if (!cancelled) setBootstrap({ industrialEnabled: false, flags: {}, modules: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prefer showing the Seasonal tab once flags are known (on or off) so a disabled
  // state can still surface with a link back to the standard roster.
  const flagsKnown = bootstrap !== null;
  const seasonalOn = isSeasonalLifecycleEnabled(bootstrap?.flags);
  const showSwitcher = Boolean(canView && flagsKnown);

  return (
    <div className="ind-personnel">
      {showSwitcher ? (
        <div className="ind-personnel-switcher" role="tablist" aria-label="Personnel views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "roster"}
            className={view === "roster" ? "is-active" : undefined}
            onClick={() => setView("roster")}
          >
            Roster
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "seasonal"}
            className={view === "seasonal" ? "is-active" : undefined}
            onClick={() => setView("seasonal")}
            title={seasonalOn ? undefined : "Seasonal lifecycle flag is off for this tenant"}
          >
            Seasonal Workforce
          </button>
        </div>
      ) : null}

      {view === "seasonal" ? (
        <SeasonalWorkforceWorkspace onGoToRoster={() => setView("roster")} />
      ) : (
        <OpsModuleWorkspace module="personnel" moduleName={moduleName} />
      )}
    </div>
  );
}
