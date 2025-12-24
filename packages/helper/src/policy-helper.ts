import type {
  PolicyCondition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyPriority,
  PolicyRule,
} from '@mtpc/core';

/**
 * 创建允许策略
 * @param id 策略 ID
 * @param permissions 允许的权限
 * @param options 策略选项
 * @returns 允许策略定义
 */
export function allow(
  id: string,
  permissions: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const rule: PolicyRule = {
    permissions,
    effect: 'allow',
    description: options.description,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'normal',
    enabled: true,
    tenantId: options.tenantId,
    metadata: options.metadata,
  };
}

/**
 * 创建拒绝策略
 * @param id 策略 ID
 * @param permissions 拒绝的权限
 * @param options 策略选项
 * @returns 拒绝策略定义
 */
export function deny(
  id: string,
  permissions: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const rule: PolicyRule = {
    permissions,
    effect: 'deny',
    description: options.description,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'high', // deny 默认高优先级
    enabled: true,
    tenantId: options.tenantId,
    metadata: options.metadata,
  };
}

/**
 * 仅允许指定角色访问指定权限
 * 基于 subject.roles 做检查
 */
export function allowForRoles(
  id: string,
  permissions: string[],
  roles: string[],
  options: {
    tenantId?: string;
    priority?: PolicyPriority;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): PolicyDefinition {
  const condition: PolicyCondition = {
    type: 'custom',
    fn: async (ctx: PolicyEvaluationContext) => roles.some(r => ctx.subject.roles?.includes(r)),
  } as PolicyCondition;

  const rule: PolicyRule = {
    permissions,
    effect: 'allow',
    conditions: [condition],
    description: options.description ?? `Allowed roles: ${roles.join(', ')}`,
  };

  return {
    id,
    name: id,
    description: options.description,
    rules: [rule],
    priority: options.priority ?? 'normal',
    enabled: true,
    tenantId: options.tenantId,
    metadata: {
      ...options.metadata,
      roles,
    },
  };
}
