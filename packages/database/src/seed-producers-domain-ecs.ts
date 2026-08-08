/**
 * Idempotent map of producers-rice-mill vanity host → Producers staging tenant.
 *
 *   node /app/packages/database/dist/seed-producers-domain-ecs.js
 *   pnpm --filter @forge/database exec tsx src/seed-producers-domain-ecs.ts
 */
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createId } from "./ids.js";
import * as schema from "./schema.js";
import { tenantDomains, tenants } from "./schema.js";

/** Staging Producers Rice Mill tenant. */
export const PRODUCERS_STAGING_TENANT_ID = "0882c865-59c2-49a6-ab88-ce6ca89be30c";
export const PRODUCERS_VANITY_HOST = "producers-rice-mill.forgepublicsafety.com";

export async function seedProducersDomain(options?: {
  databaseUrl?: string;
  tenantId?: string;
  domain?: string;
}): Promise<{ domain: string; tenantId: string; created: boolean }> {
  const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
  const connectionString = options?.databaseUrl ?? env.DATABASE_URL;
  const tenantId = options?.tenantId ?? PRODUCERS_STAGING_TENANT_ID;
  const domain = (options?.domain ?? PRODUCERS_VANITY_HOST).trim().toLowerCase();
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });
  const now = new Date();

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const [existing] = await db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, domain))
      .limit(1);

    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new Error(
          `Domain ${domain} already mapped to tenant ${existing.tenantId}, expected ${tenantId}`,
        );
      }
      if (existing.verificationStatus !== "VERIFIED") {
        await db
          .update(tenantDomains)
          .set({
            verificationStatus: "VERIFIED",
            verifiedAt: now,
            updatedAt: now,
          })
          .where(eq(tenantDomains.id, existing.id));
      }
      return { domain, tenantId, created: false };
    }

    await db.insert(tenantDomains).values({
      id: createId(),
      tenantId,
      domain,
      domainType: "CUSTOM",
      verificationStatus: "VERIFIED",
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { domain, tenantId, created: true };
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const result = await seedProducersDomain();
  console.info(JSON.stringify({ status: "ok", ...result }));
}

const isMain =
  process.argv[1]?.endsWith("seed-producers-domain-ecs.ts") ||
  process.argv[1]?.endsWith("seed-producers-domain-ecs.js");

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
