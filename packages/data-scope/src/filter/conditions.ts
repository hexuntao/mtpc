import type { FilterCondition, MTPCContext } from '@mtpc/core';
import type { ScopeValueResolver } from '../types.js';

/**
 * Create a static filter condition
 */
export function staticCondition(
  field: string,
  operator: FilterCondition['operator'],
  value: unknown
): FilterCondition {
  return { field, operator, value };
}

/**
 * Create a context-based filter condition
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
 * Create tenant equality condition
 */
export function tenantEquals(field: string = 'tenantId'): (ctx: MTPCContext) => FilterCondition {
  return ctx => ({
    field,
    operator: 'eq',
    value: ctx.tenant.id,
  });
}

/**
 * Create subject equality condition
 */
export function subjectEquals(field: string = 'createdBy'): (ctx: MTPCContext) => FilterCondition {
  return ctx => ({
    field,
    operator: 'eq',
    value: ctx.subject.id,
  });
}

/**
 * Create metadata field equality condition
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
 * Create role-based condition
 */
export function hasRole(role: string): (ctx: MTPCContext) => boolean {
  return ctx => ctx.subject.roles?.includes(role) ?? false;
}

/**
 * Conditional filter - applies filter only if condition is met
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
 * Common filter presets
 */
export const filterPresets = {
  /**
   * Filter by tenant
   */
  byTenant: tenantEquals(),

  /**
   * Filter by owner/creator
   */
  byOwner: subjectEquals(),

  /**
   * Filter by department
   */
  byDepartment: metadataEquals('departmentId', 'departmentId'),

  /**
   * Filter by team
   */
  byTeam: metadataEquals('teamId', 'teamId'),
};
