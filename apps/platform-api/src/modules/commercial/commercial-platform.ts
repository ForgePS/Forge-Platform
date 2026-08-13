import type { Database, DatabaseTransaction } from "@forge/database";
import { sql } from "drizzle-orm";

/**
 * Platform-admin transaction: sets app.bypass_rls for cross-tenant reads
 * (same pattern as worker-service event processing when tenantId is null).
 * Tenant-owned writes should still use withTenantTransaction.
 */
export async function withPlatformTransaction<T>(
  db: Database,
  callback: (tx: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return callback(tx);
  });
}
