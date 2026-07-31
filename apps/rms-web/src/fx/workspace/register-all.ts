import { registerIncidentWorkspace } from "./incidents/incident-workspace.definition";

let registered = false;

export function ensureWorkspacesRegistered(): void {
  if (registered) return;
  registerIncidentWorkspace();
  registered = true;
}
