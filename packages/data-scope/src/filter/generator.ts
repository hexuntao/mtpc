import type { FilterCondition, FilterOperator, MTPCContext } from '@mtpc/core';
import type {
  DataScopeDefinition,
  ResolvedScope,
  ScopeCondition,
  ScopeValueResolver,
} from '../types.js';

/**
 * Map scope operator to filter operator
 */
function mapOperator(scopeOp: ScopeCondition['operator']): FilterOperator {
  const mapping: Record<ScopeCondition['operator'], FilterOperator> = {
    eq: 'eq',
    neq: 'neq',
    in: 'in',
    notIn: 'notIn',
    contains: 'contains',
    hierarchy: 'in', // Hierarchy is resolved to 'in'
  };
  return mapping[scopeOp];
}

/**
 * Resolve scope value
 */
async function resolveValue(
  value: unknown | ScopeValueResolver,
  ctx: MTPCContext
): Promise<unknown> {
  if (typeof value === 'function') {
    return await (value as ScopeValueResolver)(ctx);
  }
  return value;
}

/**
 * Generate filter condition from scope condition
 */
export async function generateFilterFromCondition(
  condition: ScopeCondition,
  ctx: MTPCContext
): Promise<FilterCondition> {
  const resolvedValue = await resolveValue(condition.value, ctx);

  return {
    field: condition.field,
    operator: mapOperator(condition.operator),
    value: resolvedValue,
  };
}

/**
 * Generate filters from scope definition
 */
export async function generateFiltersFromScope(
  scope: DataScopeDefinition,
  ctx: MTPCContext
): Promise<FilterCondition[]> {
  const filters: FilterCondition[] = [];

  // Handle predefined scope types
  switch (scope.type) {
    case 'all':
      // No filters
      return [];

    case 'tenant':
      // Add tenant filter
      filters.push({
        field: 'tenantId',
        operator: 'eq',
        value: ctx.tenant.id,
      });
      break;

    case 'self':
    case 'department':
    case 'team':
    case 'subordinates':
    case 'custom':
      // Process conditions
      if (scope.conditions) {
        for (const condition of scope.conditions) {
          const filter = await generateFilterFromCondition(condition, ctx);
          filters.push(filter);
        }
      }
      break;
  }

  return filters;
}

/**
 * Resolve scope to filters
 */
export async function resolveScope(
  scope: DataScopeDefinition,
  ctx: MTPCContext
): Promise<ResolvedScope> {
  const filters = await generateFiltersFromScope(scope, ctx);

  return {
    definition: scope,
    filters,
    resolvedAt: new Date(),
  };
}

/**
 * Resolve multiple scopes
 */
export async function resolveScopes(
  scopes: DataScopeDefinition[],
  ctx: MTPCContext
): Promise<ResolvedScope[]> {
  const resolved: ResolvedScope[] = [];

  for (const scope of scopes) {
    resolved.push(await resolveScope(scope, ctx));
  }

  return resolved;
}

/**
 * Filter generator class
 */
export class FilterGenerator {
  private ctx: MTPCContext;

  constructor(ctx: MTPCContext) {
    this.ctx = ctx;
  }

  /**
   * Generate filters for a scope
   */
  async forScope(scope: DataScopeDefinition): Promise<FilterCondition[]> {
    return generateFiltersFromScope(scope, this.ctx);
  }

  /**
   * Generate filters for multiple scopes
   */
  async forScopes(scopes: DataScopeDefinition[]): Promise<FilterCondition[]> {
    const allFilters: FilterCondition[] = [];

    for (const scope of scopes) {
      const filters = await this.forScope(scope);
      allFilters.push(...filters);
    }

    return allFilters;
  }

  /**
   * Generate tenant filter
   */
  tenantFilter(): FilterCondition {
    return {
      field: 'tenantId',
      operator: 'eq',
      value: this.ctx.tenant.id,
    };
  }

  /**
   * Generate owner filter
   */
  ownerFilter(field: string = 'createdBy'): FilterCondition {
    return {
      field,
      operator: 'eq',
      value: this.ctx.subject.id,
    };
  }
}

/**
 * Create filter generator
 */
export function createFilterGenerator(ctx: MTPCContext): FilterGenerator {
  return new FilterGenerator(ctx);
}
