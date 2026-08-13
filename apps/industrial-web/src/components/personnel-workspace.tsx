"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, useAuth } from "@forge/web-kit";
import { EmptyState, PageSection } from "@/components/layout/page-chrome";
import { OpsModuleWorkspace } from "@/components/ops-module-workspace";
import { SeasonalWorkforceWorkspace } from "@/components/seasonal-workforce-workspace";
import { isSeasonalLifecycleEnabled } from "@/lib/personnel-seasonal";

type Bootstrap = {
  industrialEnabled: boolean;
  flags?: Record<string, boolean>;
  modules: Array<{ code: string; awsEnabled: boolean }>;
};

type PersonnelView = "roster" | "training" | "certifications" | "seasonal";

export function PersonnelWorkspace({ moduleName }: { moduleName: string }) {
  const { me } = useAuth();
  const permissions = new Set(me?.permissions ?? []);
  const canView =
    Boolean(me?.isPlatformAdmin) ||
    permissions.has("industrial.personnel.view") ||
    permissions.has("industrial.admin") ||
    permissions.has("industrial.access");

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

  // Prefer showing tabs once flags are known (on or off) so a disabled
  // seasonal state can still surface with a link back to the standard roster.
  const flagsKnown = bootstrap !== null;
  const seasonalOn = isSeasonalLifecycleEnabled(bootstrap?.flags);
  const showSwitcher = Boolean(canView && flagsKnown);

  function linkedRecordsPanel(kind: "training" | "certifications") {
    const title = kind === "training" ? "Training" : "Certifications";
    return (
      <div>
        <PageSection
          title={title}
          description="These open employee-linked records from the Training module."
          actions={
            <Link className="btn btn-sm btn-outline-primary" href="/modules/training">
              Open Training module
            </Link>
          }
        >
          <EmptyState
            title="Select an employee from the roster to link training (coming with assignment API)"
            description="No employee-linked records are loaded here yet. Use the Training module for course records, or return to the roster once assignment linking is available."
            action={
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setView("roster")}
              >
                Back to roster
              </button>
            }
          />
        </PageSection>
      </div>
    );
  }

  return (
    <div className="ind-personnel">
      {showSwitcher ? (
        <div className="btn-group mb-4 flex-wrap" role="tablist" aria-label="Personnel views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "roster"}
            className={`btn btn-sm ${view === "roster" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setView("roster")}
          >
            Roster
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "training"}
            className={`btn btn-sm ${view === "training" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setView("training")}
          >
            Training
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "certifications"}
            className={`btn btn-sm ${
              view === "certifications" ? "btn-primary" : "btn-outline-secondary"
            }`}
            onClick={() => setView("certifications")}
          >
            Certifications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "seasonal"}
            className={`btn btn-sm ${view === "seasonal" ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setView("seasonal")}
            title={
              seasonalOn
                ? undefined
                : "Seasonal workforce is not available yet for this organization"
            }
          >
            Seasonal Workforce
          </button>
        </div>
      ) : null}

      {view === "seasonal" ? (
        <SeasonalWorkforceWorkspace onGoToRoster={() => setView("roster")} />
      ) : view === "training" ? (
        linkedRecordsPanel("training")
      ) : view === "certifications" ? (
        linkedRecordsPanel("certifications")
      ) : (
        <OpsModuleWorkspace module="personnel" moduleName={moduleName} />
      )}
    </div>
  );
}
