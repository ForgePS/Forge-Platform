import { moduleUnavailableMessage } from "@/lib/navigation";

export function ModuleUnavailable({
  moduleName,
  status = "LEGACY_FIREBASE",
}: {
  moduleName: string;
  status?: string;
}) {
  return (
    <section className="ind-unavailable" aria-labelledby="module-unavailable-title">
      <h1 id="module-unavailable-title">{moduleName}</h1>
      <p>{moduleUnavailableMessage(moduleName)}</p>
      <p className="ind-muted">
        Status: {status} · AWS feature flag default OFF · Production authority: Firebase
      </p>
    </section>
  );
}
