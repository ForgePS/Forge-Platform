"use client";

import { useAuth } from "@forge/web-kit";
import { moduleUnavailableMessage, moduleUnavailableSummary } from "@/lib/navigation";

export function ModuleUnavailable({
  moduleName,
  status = "LEGACY_FIREBASE",
  flagOff = false,
}: {
  moduleName: string;
  status?: string;
  /** When true, AWS workspace exists but tenant flag is off. */
  flagOff?: boolean;
}) {
  const { me } = useAuth();
  const isAdmin = Boolean(me?.isPlatformAdmin);

  const effectiveStatus =
    flagOff && status !== "LEGACY_FIREBASE" && status !== "DISABLED"
      ? "MIGRATION_IN_PROGRESS"
      : status;

  const summary = moduleUnavailableSummary(effectiveStatus);

  return (
    <div className="card" aria-labelledby="module-unavailable-title">
      <div className="card-body">
        <h4 className="card-title mb-2" id="module-unavailable-title">
          {moduleName}
        </h4>
        <p className="mb-2">{moduleUnavailableMessage(moduleName, effectiveStatus)}</p>
        {isAdmin ? (
          <details className="mt-3">
            <summary className="text-muted small">Advanced details</summary>
            <p className="text-muted small mb-0 mt-2">{summary}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}
