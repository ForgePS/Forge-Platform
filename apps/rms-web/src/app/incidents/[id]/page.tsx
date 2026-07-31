import IncidentWorkspacePage from "./incident-workspace-client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function IncidentDetailPage() {
  return <IncidentWorkspacePage />;
}
