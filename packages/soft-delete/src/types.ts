import type { FilterCondition, MTPCContext, ResourceHooks } from '@mtpc/core';

/**
 * Soft delete configuration for a resource
 */
export interface SoftDeleteConfig {
  /**
   * Resource name
   */
  resourceName: string;

  /**
   * Field used to mark soft deletion (timestamp)
   * e.g. "deletedAt"
   */
  deletedAtField?: string;

  /**
   * Optional field to store who deleted the entity
   * e.g. "deletedBy"
   */
  deletedByField?: string;

  /**
   * Optional boolean flag field instead of timestamp
   * e.g. "isDeleted"
   */
  flagField?: string;

  /**
   * When true, filterQuery hook will automatically
   * exclude soft-deleted records.
   * Default: true
   */
  autoFilter?: boolean;
}

/**
 * Internal hook types
 */
export type SoftDeleteBeforeDeleteHook = (
  context: MTPCContext,
  id: string
) => Promise<{ proceed: boolean; data?: string }> | { proceed: boolean; data?: string };

export type SoftDeleteFilterQueryHook = (
  context: MTPCContext,
  baseFilters: FilterCondition[]
) => Promise<FilterCondition[]> | FilterCondition[];

/**
 * Plugin state
 */
export interface SoftDeletePluginState {
  configs: Map<string, SoftDeleteConfig>;
}
