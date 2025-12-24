import type { FilterCondition, ResourceHooks } from '@mtpc/core';
import type {
  SoftDeleteBeforeDeleteHook,
  SoftDeleteConfig,
  SoftDeleteFilterQueryHook,
} from './types.js';

/**
 * 为资源创建软删除钩子
 *
 * 说明：
 *  - 核心钩子本身无法直接更新数据库，只能约定“软删除语义”。
 *  - 具体的持久化（将 deletedAt/deletedBy 写入数据库）需要由 Adapter/Repository 实现。
 *  - 这里实现的功能：
 *      1) beforeDelete: 可以选择阻断硬删除（proceed=false），并交给上层改为软删除。
 *      2) filterQuery: 自动排除已软删除的记录。
 *
 * @param config 软删除配置
 * @returns 资源钩子的部分实现，包含软删除相关的钩子
 */
export function createSoftDeleteHooks<T = unknown>(
  config: SoftDeleteConfig
): Partial<ResourceHooks<T>> {
  // 默认的软删除时间戳字段
  const deletedAtField = config.deletedAtField ?? 'deletedAt';
  // 软删除标志字段（如果使用布尔值）
  const flagField = config.flagField;
  // 是否自动过滤软删除记录，默认true
  const autoFilter = config.autoFilter ?? true;

  /**
   * beforeDelete 钩子 - 在删除操作前执行
   *
   * 该钩子用于控制删除行为，可以选择阻断硬删除，改为软删除
   *
   * @param ctx MTPC 上下文
   * @param id 要删除的资源 ID
   * @returns 返回一个对象，proceed 为 true 表示继续删除，false 表示阻断删除
   */
  const beforeDelete: SoftDeleteBeforeDeleteHook = async (_ctx, id) => {
    // 默认行为：不阻断删除，只是为上层提供可以接入的信息
    // 若某个 Adapter 想完全阻止硬删除，可在其自己的 Hook 中判断并 return { proceed: false }
    return { proceed: true, data: id };
  };

  /**
   * filterQuery 钩子 - 在查询资源前执行
   *
   * 该钩子用于自动添加过滤条件，排除已软删除的记录
   *
   * @param ctx MTPC 上下文
   * @param baseFilters 基础过滤条件数组
   * @returns 处理后的过滤条件数组，包含排除软删除记录的条件
   */
  const filterQuery: SoftDeleteFilterQueryHook = (_ctx, baseFilters) => {
    // 如果配置了不自动过滤，则直接返回基础过滤条件
    if (!autoFilter) {
      return baseFilters;
    }

    // 创建过滤条件的副本，避免修改原始数组
    const filters: FilterCondition[] = [...baseFilters];

    if (flagField) {
      // 如果使用布尔标志字段，添加条件：flagField = false
      filters.push({
        field: flagField,
        operator: 'eq',
        value: false,
      });
    } else {
      // 否则使用时间戳字段，添加条件：deletedAtField IS NULL
      filters.push({
        field: deletedAtField,
        operator: 'isNull',
        value: null,
      } as FilterCondition);
    }

    return filters;
  };

  // 返回包含软删除钩子的对象
  return {
    beforeDelete: [beforeDelete],
    filterQuery: [filterQuery],
  };
}
