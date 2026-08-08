import { Inject, Injectable } from "@nestjs/common";
import { resolveLoginBranding } from "@forge/configuration";
import { lookupTenantByDomain, type Database } from "@forge/database";
import { ForgeError } from "@forge/errors";
import { DATABASE } from "../../tokens.js";
import { ConfigurationService } from "../configuration/configuration.service.js";

export type PublicLoginBranding = {
  tenantId: string;
  host: string;
  logoUrl?: string;
  primaryColor?: string;
  login: ReturnType<typeof resolveLoginBranding>;
};

function normalizeHost(raw: string): string {
  let host = raw.trim().toLowerCase();
  // Accept accidental scheme/path from clients.
  try {
    if (host.includes("://")) {
      host = new URL(host).hostname;
    }
  } catch {
    // keep trimmed value
  }
  const slash = host.indexOf("/");
  if (slash >= 0) host = host.slice(0, slash);
  const colon = host.indexOf(":");
  if (colon >= 0) host = host.slice(0, colon);
  return host;
}

@Injectable()
export class LoginBrandingService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly configuration: ConfigurationService,
  ) {}

  async byHost(rawHost: string | undefined): Promise<PublicLoginBranding> {
    const host = rawHost ? normalizeHost(rawHost) : "";
    if (!host) {
      throw new ForgeError("VALIDATION_FAILED", "host query parameter is required");
    }

    const resolved = await lookupTenantByDomain(this.db, host);
    if (!resolved) {
      throw new ForgeError("NOT_FOUND", `No verified tenant domain for host ${host}`);
    }

    const effective = await this.configuration.effectivePublished(
      resolved.tenantId,
      "branding",
      "default",
    );
    const payload =
      effective.payload && typeof effective.payload === "object"
        ? (effective.payload as Record<string, unknown>)
        : {};

    const logoUrl =
      typeof payload.logoUrl === "string" && payload.logoUrl.trim()
        ? payload.logoUrl.trim()
        : undefined;
    const primaryColor =
      typeof payload.primaryColor === "string" && payload.primaryColor.trim()
        ? payload.primaryColor.trim()
        : undefined;

    return {
      tenantId: resolved.tenantId,
      host,
      ...(logoUrl ? { logoUrl } : {}),
      ...(primaryColor ? { primaryColor } : {}),
      login: resolveLoginBranding(payload as Parameters<typeof resolveLoginBranding>[0]),
    };
  }
}
