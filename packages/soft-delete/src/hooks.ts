import type { FilterCondition, MTPCContext, ResourceHooks } from '@mtpc/core';
import type {
  SoftDeleteBeforeDeleteHook,
  SoftDeleteConfig,
  SoftDeleteFilterQueryHook,
} from './types.js';

/**
 * Create soft delete hooks for a resource.
 *
 * NOTE:
 *  - Core hooks本身无法直接更新数据库，只能约定“软删除语义”。
 *  - 具体的持久化（将 deletedAt/deletedBy 写入 DB）需要由 Adapter/Repository 实现。
 *  - 这里做的事情：
 *      1) beforeDelete: 可以选择阻断硬删除（proceed=false），并交给上层改为软删除。
 *      2) filterQuery: 自动排除已软删除的记录。
 */
export function createSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig
): Partial<ResourceHooks<T>> {
  const deletedAtField = config.deletedAtField ?? 'deletedAt';
  const flagField = config.flagField;
  const autoFilter = config.autoFilter ?? true;

  const beforeDelete: SoftDeleteBeforeDeleteHook = async (ctx, id) => {
    // 默认行为：不阻断 delete，只是为上层提供可以接入的信息。
    // 若某个 Adapter 想完全阻止硬删除，可在其自己的 Hook 中判断并 return { proceed: false }。
    return { proceed: true, data: id };
  };

  const filterQuery: SoftDeleteFilterQueryHook = (ctx, baseFilters) => {
    if (!autoFilter) {
      return baseFilters;
    }

    const filters: FilterCondition[] = [...baseFilters];

    if (flagField) {
      filters.push({
        field: flagField,
        operator: 'eq',
        value: false,
      });
    } else {
      filters.push({
        field: deletedAtField,
        operator: 'isNull',
        value: null,
      } as FilterCondition);
    }

    return filters;
  };

  return {
    beforeDelete: [beforeDelete],
    filterQuery: [filterQuery],
  };
}
