/** Mobile drawer helpers — behavior lives in RmsFxShell. */
export const MOBILE_NAV_BREAKPOINT_PX = 1023;

export function shouldUseMobileNavDisclosure(width: number): boolean {
  return width <= MOBILE_NAV_BREAKPOINT_PX;
}
