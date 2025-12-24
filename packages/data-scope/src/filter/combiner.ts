import type { FilterCondition } from '@mtpc/core';
import type { ResolvedScope } from '../types.js';

/**
 * 组合模式
 */
export type CombineMode = 'and' | 'or' | 'priority';

/**
 * 组合多个过滤器数组
 */
export function combineFilters(
  filterArrays: FilterCondition[][],
  mode: CombineMode = 'and'
): FilterCondition[] {
  switch (mode) {
    case 'and':
      // 所有过滤器都适用（展平）
      return filterArrays.flat();

    case 'or':
      // 任何过滤器集都可以匹配 - 这需要在查询层特殊处理
      // 现在，我们只是展平（消费者需要处理 OR 逻辑）
      return filterArrays.flat();

    case 'priority':
      // 仅使用第一个非空过滤器集
      for (const filters of filterArrays) {
        if (filters.length > 0) {
          return filters;
        }
      }
      return [];

    default:
      // 默认使用 AND 组合
      return filterArrays.flat();
  }
}

/**
 * 组合已解析的范围
 */
export function combineResolvedScopes(
  scopes: ResolvedScope[],
  mode: CombineMode = 'and'
): FilterCondition[] {
  // 按优先级排序（高到低）
  const sorted = [...scopes].sort(
    (a, b) => (b.definition.priority ?? 0) - (a.definition.priority ?? 0)
  );

  // 检查是否有排他范围（不可组合）
  const exclusive = sorted.find(s => !s.definition.combinable);
  if (exclusive) {
    // 仅使用排他范围的过滤器
    return exclusive.filters;
  }

  // 组合所有范围的过滤器
  return combineFilters(
    sorted.map(s => s.filters),
    mode
  );
}

/**
 * 过滤器去重
 */
export function deduplicateFilters(filters: FilterCondition[]): FilterCondition[] {
  const seen = new Set<string>();
  const result: FilterCondition[] = [];

  for (const filter of filters) {
    const key = `${filter.field}:${filter.operator}:${JSON.stringify(filter.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(filter);
    }
  }

  return result;
}

/**
 * 与现有过滤器合并
 */
export function mergeWithExisting(
  existing: FilterCondition[],
  newFilters: FilterCondition[],
  dedupe: boolean = true
): FilterCondition[] {
  const combined = [...existing, ...newFilters];
  return dedupe ? deduplicateFilters(combined) : combined;
}

/**
 * 检查过滤器是否冲突
 */
export function hasConflict(filters: FilterCondition[]): boolean {
  const fieldValues = new Map<string, { operator: string; values: unknown[] }>();

  for (const filter of filters) {
    const existing = fieldValues.get(filter.field);

    if (existing) {
      // 检查相同字段上的 eq/neq 冲突
      if (
        (existing.operator === 'eq' && filter.operator === 'neq') ||
        (existing.operator === 'neq' && filter.operator === 'eq')
      ) {
        if (existing.values.includes(filter.value)) {
          return true;
        }
      }
    } else {
      fieldValues.set(filter.field, {
        operator: filter.operator,
        values: [filter.value],
      });
    }
  }

  return false;
}
