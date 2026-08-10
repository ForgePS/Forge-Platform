import type { AuthMe } from "./auth-api.js";

/**
 * Server-verified tenant switch with local persistence rollback on failure.
 * Always replaces the AuthMe summary on success so prior tenant capabilities
 * cannot linger in client memory.
 */
export async function switchActiveTenant(input: {
  tenantId: string;
  previousTenantId: string | null;
  selectTenant: (tenantId: string) => Promise<AuthMe>;
  setActiveTenantId: (tenantId: string) => void;
  clearActiveTenantId: () => void;
}): Promise<AuthMe> {
  input.setActiveTenantId(input.tenantId);
  try {
    return await input.selectTenant(input.tenantId);
  } catch (error) {
    if (input.previousTenantId) {
      input.setActiveTenantId(input.previousTenantId);
    } else {
      input.clearActiveTenantId();
    }
    throw error;
  }
}
