export const COORDINATION_MODULES = ["tasks", "messaging", "emergency-response"] as const;
export type CoordinationModule = (typeof COORDINATION_MODULES)[number];

export function isInd7CoordinationModule(value: string): value is CoordinationModule {
  return COORDINATION_MODULES.includes(value as CoordinationModule);
}
