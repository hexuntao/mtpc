import type { FilterCondition, FilterOperator, MTPCContext } from '@mtpc/core';
import type {
  DataScopeDefinition,
  HierarchyResolver,
  ResolvedScope,
  ScopeCondition,
  ScopeValueResolver,
} from '../types.js';

// 保存层级解析器的全局引用
let globalHierarchyResolver: HierarchyResolver | undefined;

/**
 * 设置全局层级解析器
 */
export function setHierarchyResolver(resolver: HierarchyResolver): void {
  globalHierarchyResolver = resolver;
}

/**
 * 将范围操作符映射为过滤器操作符
 */
function mapOperator(scopeOp: ScopeCondition['operator']): FilterOperator {
  const mapping: Record<ScopeCondition['operator'], FilterOperator> = {
    eq: 'eq',
    neq: 'neq',
    in: 'in',
    notIn: 'notIn',
    contains: 'contains',
    hierarchy: 'in', // 层级操作符映射为 'in'，需要先解析值
  };
  return mapping[scopeOp];
}

/**
 * 解析范围值
 */
async function resolveValue(
  value: unknown | ScopeValueResolver,
  ctx: MTPCContext,
  operator?: ScopeCondition['operator']
): Promise<unknown> {
  // 如果是函数，执行它
  if (typeof value === 'function') {
    const resolved = await (value as ScopeValueResolver)(ctx);

    // 如果是层级操作符且解析结果是字符串，使用层级解析器展开
    if (operator === 'hierarchy' && typeof resolved === 'string' && globalHierarchyResolver) {
      return globalHierarchyResolver.resolveRoot(resolved);
    }

    return resolved;
  }

  // 如果是层级操作符且值是字符串，使用层级解析器展开
  if (operator === 'hierarchy' && typeof value === 'string' && globalHierarchyResolver) {
    return globalHierarchyResolver.resolveRoot(value);
  }

  return value;
}

/**
 * 从范围条件生成过滤条件
 */
export async function generateFilterFromCondition(
  condition: ScopeCondition,
  ctx: MTPCContext
): Promise<FilterCondition> {
  const resolvedValue = await resolveValue(condition.value, ctx, condition.operator);

  return {
    field: condition.field,
    operator: mapOperator(condition.operator),
    value: resolvedValue,
  };
}

/**
 * 从范围定义生成过滤器
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
 * 将范围解析为过滤器
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
 * 解析多个范围
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
 * 过滤器生成器类
 */
export class FilterGenerator {
  private ctx: MTPCContext;

  constructor(ctx: MTPCContext) {
    this.ctx = ctx;
  }

  /**
   * 为范围生成过滤器
   */
  async forScope(scope: DataScopeDefinition): Promise<FilterCondition[]> {
    return generateFiltersFromScope(scope, this.ctx);
  }

  /**
   * 为多个范围生成过滤器
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
   * 生成租户过滤器
   */
  tenantFilter(): FilterCondition {
    return {
      field: 'tenantId',
      operator: 'eq',
      value: this.ctx.tenant.id,
    };
  }

  /**
   * 生成所有者过滤器
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
 * 创建过滤器生成器
 */
export function createFilterGenerator(ctx: MTPCContext): FilterGenerator {
  return new FilterGenerator(ctx);
}
