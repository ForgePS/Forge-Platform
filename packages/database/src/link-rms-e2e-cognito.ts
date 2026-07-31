/**
 * Link a Cognito subject to the synthetic RMS admin user (development acceptance).
 *
 * Usage (ECS one-off or local with DATABASE_URL):
 *   RMS_E2E_COGNITO_SUB=<cognito-sub> node dist/link-rms-e2e-cognito.js
 *
 * Optional:
 *   RMS_E2E_ADMIN_EMAIL=admin@rms-synthetic.test
 *   RMS_SYNTHETIC_TENANT_KEY=rms-synthetic-fd
 */
import { LOCAL_PLACEHOLDER_ENV, loadEnvironmentAsync } from "@forge/environment";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { createId } from "./ids.js";
import * as schema from "./schema.js";
import { authenticationIdentities, tenants, users } from "./schema.js";
import { RMS_SYNTHETIC_TENANT_KEY } from "./seed-rms-synthetic.js";

export async function linkRmsE2eCognito(options?: {
  databaseUrl?: string;
  cognitoSub?: string;
  adminEmail?: string;
  tenantKey?: string;
}): Promise<{
  tenantId: string;
  userId: string;
  identityId: string;
  cognitoSub: string;
  created: boolean;
}> {
  const env = await loadEnvironmentAsync({ ...LOCAL_PLACEHOLDER_ENV, ...process.env });
  const cognitoSub = (options?.cognitoSub ?? process.env.RMS_E2E_COGNITO_SUB ?? "").trim();
  if (!cognitoSub) {
    throw new Error("RMS_E2E_COGNITO_SUB is required");
  }
  const adminEmail = (
    options?.adminEmail ??
    process.env.RMS_E2E_ADMIN_EMAIL ??
    "admin@rms-synthetic.test"
  ).trim();
  const tenantKey = (
    options?.tenantKey ??
    process.env.RMS_SYNTHETIC_TENANT_KEY ??
    RMS_SYNTHETIC_TENANT_KEY
  ).trim();

  const client = postgres(options?.databaseUrl ?? env.DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema });
  const now = new Date();

  try {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.tenantKey, tenantKey))
      .limit(1);
    if (!tenant) {
      throw new Error(`Tenant ${tenantKey} not found — run seed-rms-synthetic first`);
    }

    const [admin] = await db
      .select({ id: users.id, primaryEmail: users.primaryEmail })
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.primaryEmail, adminEmail)))
      .limit(1);
    if (!admin) {
      throw new Error(`Admin user ${adminEmail} not found on tenant ${tenantKey}`);
    }

    const [existingBySub] = await db
      .select()
      .from(authenticationIdentities)
      .where(
        and(
          eq(authenticationIdentities.provider, "COGNITO"),
          eq(authenticationIdentities.providerSubject, cognitoSub),
        ),
      )
      .limit(1);

    if (existingBySub) {
      if (existingBySub.userId !== admin.id) {
        throw new Error(
          `Cognito sub ${cognitoSub} is already linked to a different user (${existingBySub.userId})`,
        );
      }
      await db
        .update(authenticationIdentities)
        .set({ lastAuthenticatedAt: now, emailAtLinkTime: admin.primaryEmail })
        .where(eq(authenticationIdentities.id, existingBySub.id));
      return {
        tenantId: tenant.id,
        userId: admin.id,
        identityId: existingBySub.id,
        cognitoSub,
        created: false,
      };
    }

    const identityId = createId();
    await db.insert(authenticationIdentities).values({
      id: identityId,
      tenantId: tenant.id,
      userId: admin.id,
      provider: "COGNITO",
      providerSubject: cognitoSub,
      emailAtLinkTime: admin.primaryEmail,
      createdAt: now,
      lastAuthenticatedAt: now,
    });

    return {
      tenantId: tenant.id,
      userId: admin.id,
      identityId,
      cognitoSub,
      created: true,
    };
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const result = await linkRmsE2eCognito();
  // eslint-disable-next-line no-console -- CLI output
  console.info(JSON.stringify({ ok: true, ...result }, null, 2));
}

const isDirect =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (
  isDirect ||
  process.argv[1]?.endsWith("link-rms-e2e-cognito.ts") ||
  process.argv[1]?.endsWith("link-rms-e2e-cognito.js")
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
