/**
 * Parse and evaluate Nest CORS origin allowlists from CORS_ORIGINS.
 * Never use wildcard origins with credentialed authenticated browser requests.
 */

export function parseCorsOrigins(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.includes(origin);
}

/** Development frontend origins expected on the Platform API allowlist. */
export const DEVELOPMENT_BROWSER_ORIGINS = [
  "https://creator-dev.forgepublicsafety.com",
  "https://admin-dev.forgepublicsafety.com",
  "https://industrial-dev.forgepublicsafety.com",
  "https://producers-rice-mill.forgepublicsafety.com",
  "https://rms-dev.forgepublicsafety.com",
] as const;
