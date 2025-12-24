import type { FilterCondition } from '@mtpc/core';
import type { DataScopeDefinition, ResolvedScope } from '../types.js';

/**
 * Combine mode
 */
export type CombineMode = 'and' | 'or' | 'priority';

/**
 * Combine multiple filter arrays
 */
export function combineFilters(
  filterArrays: FilterCondition[][],
  mode: CombineMode = 'and'
): FilterCondition[] {
  switch (mode) {
    case 'and':
      // All filters apply (flatten)
      return filterArrays.flat();

    case 'or':
      // Any filter set can match - this would need special handling in the query layer
      // For now, we just flatten (consumers need to handle OR logic)
      return filterArrays.flat();

    case 'priority':
      // Only use first non-empty filter set
      for (const filters of filterArrays) {
        if (filters.length > 0) {
          return filters;
        }
      }
      return [];

    default:
      return filterArrays.flat();
  }
}

/**
 * Combine resolved scopes
 */
export function combineResolvedScopes(
  scopes: ResolvedScope[],
  mode: CombineMode = 'and'
): FilterCondition[] {
  // Sort by priority
  const sorted = [...scopes].sort(
    (a, b) => (b.definition.priority ?? 0) - (a.definition.priority ?? 0)
  );

  // Check for exclusive (non-combinable) scopes
  const exclusive = sorted.find(s => !s.definition.combinable);
  if (exclusive) {
    // Only use the exclusive scope
    return exclusive.filters;
  }

  // Combine all scope filters
  return combineFilters(
    sorted.map(s => s.filters),
    mode
  );
}

/**
 * Deduplicate filters
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
 * Merge filters with existing ones
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
 * Check if filters conflict
 */
export function hasConflict(filters: FilterCondition[]): boolean {
  const fieldValues = new Map<string, { operator: string; values: unknown[] }>();

  for (const filter of filters) {
    const existing = fieldValues.get(filter.field);

    if (existing) {
      // Check for eq/neq conflict on same field
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
