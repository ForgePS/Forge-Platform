import { moduleUnavailableMessage } from "@/lib/navigation";

export function ModuleUnavailable({
  moduleName,
  status = "LEGACY_FIREBASE",
}: {
  moduleName: string;
  status?: string;
}) {
  return (
    <div className="card" aria-labelledby="module-unavailable-title">
      <div className="card-body">
        <h4 className="card-title mb-2" id="module-unavailable-title">
          {moduleName}
        </h4>
        <p className="mb-2">{moduleUnavailableMessage(moduleName)}</p>
        <p className="text-muted small mb-0">
          Status: {status} · AWS feature flag default OFF · Production authority: Firebase
        </p>
      </div>
    </div>
  );
}
