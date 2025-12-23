import type { PolicyDefinition, PolicyRule } from '@mtpc/core';
import type { RBACStore, RoleDefinition } from '../types.js';

/**
 * 将角色编译为 MTPC 策略
 * 将 RBAC 角色定义转换为 MTPC 策略格式
 *
 * 功能：
 * - 将角色权限转换为策略规则
 * - 自动设置策略优先级
 * - 支持租户隔离
 *
 * @example
 * ```typescript
 * const policies = await compileRolesToPolicies(store, 'tenant-001');
 * for (const policy of policies) {
 *   console.log(`Policy: ${policy.name}, Rules: ${policy.rules.length}`);
 * }
 * ```
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
 * 将单个角色编译为策略
 * 将角色定义转换为 MTPC 策略定义
 *
 * @param role 角色定义
 * @returns MTPC 策略定义
 *
 * @example
 * ```typescript
 * const role: RoleDefinition = {
 *   id: 'role-001',
 *   name: 'editor',
 *   permissions: ['content:read', 'content:write'],
 *   // ...
 * };
 *
 * const policy = compileRoleToPolicy(role);
 * console.log(policy.id); // 'rbac-role-role-001'
 * ```
 */
export function compileRoleToPolicy(role: RoleDefinition): PolicyDefinition {
  const rules: PolicyRule[] = [];

  // 为所有角色权限添加允许规则
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
 * 从角色 ID 创建策略 ID
 * 生成与角色对应的策略 ID
 *
 * @param roleId 角色 ID
 * @returns 策略 ID
 *
 * @example
 * ```typescript
 * const policyId = roleToPolicyId('role-001');
 * console.log(policyId); // 'rbac-role-role-001'
 * ```
 */
export function roleToPolicyId(roleId: string): string {
  return `rbac-role-${roleId}`;
}

/**
 * 从策略 ID 提取角色 ID
 * 从 RBAC 生成的策略 ID 中提取原始角色 ID
 *
 * @param policyId 策略 ID
 * @returns 角色 ID，如果不是 RBAC 策略则返回 null
 *
 * @example
 * ```typescript
 * const roleId = policyToRoleId('rbac-role-role-001');
 * console.log(roleId); // 'role-001'
 *
 * const invalid = policyToRoleId('other-policy');
 * console.log(invalid); // null
 * ```
 */
export function policyToRoleId(policyId: string): string | null {
  if (policyId.startsWith('rbac-role-')) {
    return policyId.slice(10);
  }
  return null;
}
