import type {
  PolicyCondition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyPriority,
  PolicyRule,
} from '@mtpc/core';
import { getByPath } from '@mtpc/shared';

/**
 * ABAC 策略配置
 */
export interface ABACPolicyConfig {
  /** 策略名称 */
  name?: string;
  /** 策略描述 */
  description?: string;
  tenantId?: string;
  /** 策略权限 */
  permissions: string[];
  /** 策略条件 */
  conditions: PolicyCondition[];
  /** 策略优先级 */
  priority?: PolicyPriority;
  /** 是否启用 */
  enabled?: boolean;
  /** 策略元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 创建自定义策略条件
 * @param fn 条件函数，接收策略评估上下文，返回布尔值或 Promise<布尔值>
 * @param description 条件描述，用于调试
 * @returns 自定义策略条件
 */
function customCondition(
  fn: (ctx: PolicyEvaluationContext) => boolean | Promise<boolean>,
  description?: string
): PolicyCondition {
  return {
    type: 'custom',
    fn,
    // 自定义条件描述，用于调试
    metadata: { description },
  } as PolicyCondition;
}

/**
 * 创建属性等于条件
 * @param resourceField 资源字段路径
 * @param contextPath 上下文路径
 * @returns 属性等于条件
 */
export function attrEquals(resourceField: string, contextPath: string): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const left = resource[resourceField];
    const right = getByPath(ctx as unknown as Record<string, unknown>, contextPath);
    return left === right;
  }, `resource.${resourceField} === ctx.${contextPath}`);
}

/**
 * 创建属性包含条件
 * @param resourceField 资源字段路径
 * @param contextPath 上下文路径
 * @returns 属性包含条件
 */
export function attrIn(resourceField: string, contextPath: string): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const left = resource[resourceField];
    const arr = getByPath(ctx as unknown as Record<string, unknown>, contextPath);
    return Array.isArray(arr) && arr.includes(left);
  }, `resource.${resourceField} in ctx.${contextPath}`);
}

/**
 * 创建资源所有者条件
 * @param ownerField 资源所有者字段路径
 * @returns 资源所有者条件
 */
export function ownResource(ownerField: string = 'createdBy'): PolicyCondition {
  return customCondition(ctx => {
    const resource = (ctx.resource ?? {}) as Record<string, unknown>;
    const owner = resource[ownerField];
    return owner === ctx.subject.id;
  }, `resource.${ownerField} === ctx.subject.id`);
}

/**
 * 创建部门相等条件
 * @param resourceField 资源部门字段路径
 * @param contextPath 上下文部门路径
 * @returns 部门相等条件
 */
export function sameDepartment(
  resourceField: string = 'departmentId',
  contextPath: string = 'subject.metadata.departmentId'
): PolicyCondition {
  return attrEquals(resourceField, contextPath);
}

/**
 * 创建团队相等条件
 * @param resourceField 资源团队字段路径
 * @param contextPath 上下文团队路径
 * @returns 团队相等条件
 */
export function sameTeam(
  resourceField: string = 'teamId',
  contextPath: string = 'subject.metadata.teamId'
): PolicyCondition {
  return attrEquals(resourceField, contextPath);
}

/**
 * 创建 ABAC 策略定义
 * @param id 策略 ID
 * @param config 策略配置
 * @returns ABAC 策略定义
 */
export function policy(id: string, config: ABACPolicyConfig): PolicyDefinition {
  const rule: PolicyRule = {
    permissions: config.permissions,
    effect: 'allow',
    conditions: config.conditions,
    priority: config.priority,
    description: config.description,
  };

  return {
    id,
    name: config.name ?? id,
    description: config.description,
    rules: [rule],
    priority: config.priority ?? 'normal',
    enabled: config.enabled ?? true,
    tenantId: config.tenantId,
    metadata: config.metadata,
  };
}
