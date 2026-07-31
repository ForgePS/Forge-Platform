import { RMS_FX_TABLES_FLAG } from "./tables-flags";
import { registerTable } from "./FxTableRegistry";

let registered = false;

export function ensureTablesRegistered(): void {
  if (registered) return;
  const tables = [
    {
      id: "rms-incidents-list",
      title: "Incidents list",
      route: "/incidents/",
    },
    {
      id: "rms-review-queue",
      title: "Officer review queue",
      route: "/review/",
    },
    {
      id: "rms-cad-messages",
      title: "CAD message metadata",
      route: "/cad/messages/",
    },
    {
      id: "rms-cad-connections",
      title: "CAD connections",
      route: "/cad/connections/",
    },
  ] as const;

  for (const table of tables) {
    try {
      registerTable({ ...table, featureFlag: RMS_FX_TABLES_FLAG });
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("already registered"))) throw err;
    }
  }
  registered = true;
}
