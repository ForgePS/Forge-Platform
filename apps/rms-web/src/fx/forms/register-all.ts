import { RMS_FX_FORMS_FLAG } from "./forms-flags";
import { registerForm } from "./FxFormRegistry";

let registered = false;

export function ensureFormsRegistered(): void {
  if (registered) return;
  const forms = [
    {
      id: "rms-new-incident",
      title: "New manual incident",
      description: "Manual intake create form",
      route: "/incidents/new/",
    },
    {
      id: "rms-cad-connection-create",
      title: "CAD connection create",
      description: "Synthetic CAD connection name form",
      route: "/cad/connections/",
    },
    {
      id: "rms-officer-review",
      title: "Officer review actions",
      description: "Submit, comment, return, approve — presentation chrome only",
      route: "/incidents/[id]/?section=REVIEW",
    },
  ] as const;

  for (const form of forms) {
    try {
      registerForm({ ...form, featureFlag: RMS_FX_FORMS_FLAG });
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("already registered"))) throw err;
    }
  }
  registered = true;
}
