import type { FilterCondition, MTPCContext } from '@mtpc/core';
import type { ScopeValueResolver } from '../types.js';

/**
 * 创建静态过滤条件
 */
export function staticCondition(
  field: string,
  operator: FilterCondition['operator'],
  value: unknown
): FilterCondition {
  return { field, operator, value };
}

/**
 * 创建基于上下文的过滤条件
 */
export function contextCondition(
  field: string,
  operator: FilterCondition['operator'],
  resolver: ScopeValueResolver
): (ctx: MTPCContext) => Promise<FilterCondition> {
  return async (ctx: MTPCContext) => ({
    field,
    operator,
    value: await resolver(ctx),
  });
}

/**
 * 创建租户相等条件
 */
export function tenantEquals(field: string = 'tenantId'): (ctx: MTPCContext) => FilterCondition {
  return ctx => ({
    field,
    operator: 'eq',
    value: ctx.tenant.id,
  });
}

/**
 * 创建主体相等条件
 */
export function subjectEquals(field: string = 'createdBy'): (ctx: MTPCContext) => FilterCondition {
  return ctx => ({
    field,
    operator: 'eq',
    value: ctx.subject.id,
  });
}

/**
 * 创建元数据字段相等条件
 */
export function metadataEquals(
  resourceField: string,
  metadataKey: string
): (ctx: MTPCContext) => FilterCondition {
  return ctx => ({
    field: resourceField,
    operator: 'eq',
    value: ctx.subject.metadata?.[metadataKey],
  });
}

/**
 * 创建基于角色的条件
 */
export function hasRole(role: string): (ctx: MTPCContext) => boolean {
  return ctx => ctx.subject.roles?.includes(role) ?? false;
}

/**
 * 条件过滤器 - 仅在满足条件时应用过滤器
 */
export function conditionalFilter(
  condition: (ctx: MTPCContext) => boolean,
  filter: (ctx: MTPCContext) => FilterCondition
): (ctx: MTPCContext) => FilterCondition | null {
  return ctx => {
    if (condition(ctx)) {
      return filter(ctx);
    }
    return null;
  };
}

/**
 * 通用过滤器预设
 */
export const filterPresets = {
  /**
   * 按租户过滤
   */
  byTenant: tenantEquals(),

  /**
   * 按所有者/创建者过滤
   */
  byOwner: subjectEquals(),

  /**
   * 按部门过滤
   */
  byDepartment: metadataEquals('departmentId', 'departmentId'),

  /**
   * 按团队过滤
   */
  byTeam: metadataEquals('teamId', 'teamId'),
};
