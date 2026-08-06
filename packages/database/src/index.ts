import { sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * from "./schema.js";
export { createId } from "./ids.js";
export * from "./identity-lookup.js";

export type Database = ReturnType<typeof createDatabase>;

export type DatabaseTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  return drizzle(client, { schema });
}

const sharedDatabases = new Map<string, Database>();

/**
 * Process-wide shared drizzle client. Prefer this in long-running workers so
 * each job does not open a new postgres.js pool (max 10) that is never closed.
 */
export function getSharedDatabase(connectionString: string): Database {
  const existing = sharedDatabases.get(connectionString);
  if (existing) return existing;
  const db = createDatabase(connectionString);
  sharedDatabases.set(connectionString, db);
  return db;
}

export async function checkDatabaseHealth(connectionString: string): Promise<boolean> {
  const client = postgres(connectionString, { max: 1 });
  try {
    await client`select 1`;
    return true;
  } finally {
    await client.end({ timeout: 5 });
  }
}

export type OutboxHealth = {
  ok: boolean;
  pending: number | null;
  failed: number | null;
};

/** Lightweight outbox probe for readiness (pending + failed counts). */
export async function checkOutboxHealth(connectionString: string): Promise<OutboxHealth> {
  const client = postgres(connectionString, { max: 1 });
  try {
    const rows = await client<{ pending: string; failed: string }[]>`
      select
        count(*) filter (where status = 'PENDING')::text as pending,
        count(*) filter (where status = 'FAILED')::text as failed
      from outbox_events
    `;
    const row = rows[0];
    return {
      ok: true,
      pending: row ? Number(row.pending) : 0,
      failed: row ? Number(row.failed) : 0,
    };
  } catch {
    return { ok: false, pending: null, failed: null };
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** Prepares PostgreSQL session tenant context for RLS. */
export async function setTenantContext(
  sqlClient: postgres.Sql,
  tenantId: string,
  userId?: string,
): Promise<void> {
  await sqlClient`select set_config('app.current_tenant_id', ${tenantId}, true)`;
  if (userId) {
    await sqlClient`select set_config('app.current_user_id', ${userId}, true)`;
  }
}

/**
 * Begins a transaction, sets tenant (and optional user) session context via
 * SET LOCAL semantics (`set_config(..., true)`), then runs the callback.
 */
export async function withTenantTransaction<T>(
  db: Database,
  tenantId: string,
  callback: (tx: DatabaseTransaction) => Promise<T>,
  userId?: string,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
    if (userId) {
      await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    }
    return callback(tx);
  });
}
