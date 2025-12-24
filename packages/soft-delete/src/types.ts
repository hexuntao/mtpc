import type { FilterCondition, MTPCContext } from '@mtpc/core';

/**
 * 资源的软删除配置
 */
export interface SoftDeleteConfig {
  /**
   * 资源名称
   */
  resourceName: string;

  /**
   * 用于标记软删除的时间戳字段
   * 例如："deletedAt"
   */
  deletedAtField?: string;

  /**
   * 可选字段，用于存储谁删除了实体
   * 例如："deletedBy"
   */
  deletedByField?: string;

  /**
   * 可选的布尔标志字段，代替时间戳
   * 例如："isDeleted"
   */
  flagField?: string;

  /**
   * 当为 true 时，filterQuery 钩子会自动排除软删除的记录
   * 默认值：true
   */
  autoFilter?: boolean;
}

/**
 * 内部钩子类型定义
 */

/**
 * 软删除的 beforeDelete 钩子类型
 * @param context MTPC 上下文
 * @param id 资源 ID
 * @returns 包含 proceed 字段的对象，proceed 为 true 表示继续删除，false 表示阻断删除
 */
export type SoftDeleteBeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<{ proceed: boolean; data?: string }> | { proceed: boolean; data?: string };

/**
 * 软删除的 filterQuery 钩子类型
 * @param context MTPC 上下文
 * @param baseFilters 基础过滤条件
 * @returns 处理后的过滤条件数组，通常会自动添加排除软删除记录的条件
 */
export type SoftDeleteFilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];

/**
 * 软删除插件的内部状态
 */
export interface SoftDeletePluginState {
  /**
   * 存储所有资源的软删除配置
   * 键为资源名称，值为对应的软删除配置
   */
  configs: Map<string, SoftDeleteConfig>;
}
