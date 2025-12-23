import type { PolicyDefinition, PolicyRule } from '@mtpc/core';
import type { RBACStore, RoleDefinition } from '../types.js';

/**
 * Compile roles to MTPC policies
 */
export async function compileRolesToPolicies(
  store: RBACStore,
  tenantId: string
): Promise<PolicyDefinition[]> {
  const roles = await store.listRoles(tenantId, { status: 'active' });
  const policies: PolicyDefinition[] = [];

  for (const role of roles) {
    const policy = compileRoleToPolicy(role);
    policies.push(policy);
  }

  return policies;
}

/**
 * Compile single role to policy
 */
export function compileRoleToPolicy(role: RoleDefinition): PolicyDefinition {
  const rules: PolicyRule[] = [];

  // Add allow rule for all role permissions
  if (role.permissions.length > 0) {
    rules.push({
      permissions: role.permissions,
      effect: 'allow',
      description: `Permissions from role: ${role.name}`,
    });
  }

  return {
    id: `rbac-role-${role.id}`,
    name: `RBAC: ${role.displayName ?? role.name}`,
    description: role.description,
    rules,
    priority: role.type === 'system' ? 'high' : 'normal',
    enabled: role.status === 'active',
    tenantId: role.tenantId,
    metadata: {
      roleId: role.id,
      roleName: role.name,
      roleType: role.type,
    },
  };
}

/**
 * Create policy ID from role ID
 */
export function roleToPolicyId(roleId: string): string {
  return `rbac-role-${roleId}`;
}

/**
 * Extract role ID from policy ID
 */
export function policyToRoleId(policyId: string): string | null {
  if (policyId.startsWith('rbac-role-')) {
    return policyId.slice(10);
  }
  return null;
}
