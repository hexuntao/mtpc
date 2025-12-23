import type {
  ResourceHooks,
  MTPCContext,
  HookResult,
  QueryOptions,
  FilterCondition,
} from '../types/index.js';

/**
 * Hook executor for a resource
 */
export class HookExecutor<T = unknown> {
  private hooks: ResourceHooks<T>;

  constructor(hooks: ResourceHooks<T>) {
    this.hooks = hooks;
  }

  /**
   * Execute before create hooks
   */
  async executeBeforeCreate(
    context: MTPCContext,
    data: T
  ): Promise<HookResult<T>> {
    let currentData = data;

    for (const hook of this.hooks.beforeCreate ?? []) {
      const result = await hook(context, currentData);
      
      if (!result.proceed) {
        return result;
      }
      
      if (result.data !== undefined) {
        currentData = result.data;
      }
    }

    return { proceed: true, data: currentData };
  }

  /**
   * Execute after create hooks
   */
  async executeAfterCreate(
    context: MTPCContext,
    data: T,
    created: T
  ): Promise<void> {
    for (const hook of this.hooks.afterCreate ?? []) {
      await hook(context, data, created);
    }
  }

  /**
   * Execute before read hooks
   */
  async executeBeforeRead(
    context: MTPCContext,
    id: string
  ): Promise<HookResult<string>> {
    let currentId = id;

    for (const hook of this.hooks.beforeRead ?? []) {
      const result = await hook(context, currentId);
      
      if (!result.proceed) {
        return result;
      }
      
      if (result.data !== undefined) {
        currentId = result.data;
      }
    }

    return { proceed: true, data: currentId };
  }

  /**
   * Execute after read hooks
   */
  async executeAfterRead(
    context: MTPCContext,
    id: string,
    data: T | null
  ): Promise<T | null> {
    let currentData = data;

    for (const hook of this.hooks.afterRead ?? []) {
      currentData = await hook(context, id, currentData);
    }

    return currentData;
  }

  /**
   * Execute before update hooks
   */
  async executeBeforeUpdate(
    context: MTPCContext,
    id: string,
    data: Partial<T>
  ): Promise<HookResult<Partial<T>>> {
    let currentData = data;

    for (const hook of this.hooks.beforeUpdate ?? []) {
      const result = await hook(context, id, currentData);
      
      if (!result.proceed) {
        return result;
      }
      
      if (result.data !== undefined) {
        currentData = result.data;
      }
    }

    return { proceed: true, data: currentData };
  }

  /**
   * Execute after update hooks
   */
  async executeAfterUpdate(
    context: MTPCContext,
    id: string,
    data: Partial<T>,
    updated: T
  ): Promise<void> {
    for (const hook of this.hooks.afterUpdate ?? []) {
      await hook(context, id, data, updated);
    }
  }

  /**
   * Execute before delete hooks
   */
  async executeBeforeDelete(
    context: MTPCContext,
    id: string
  ): Promise<HookResult<string>> {
    let currentId = id;

    for (const hook of this.hooks.beforeDelete ?? []) {
      const result = await hook(context, currentId);
      
      if (!result.proceed) {
        return result;
      }
      
      if (result.data !== undefined) {
        currentId = result.data;
      }
    }

    return { proceed: true, data: currentId };
  }

  /**
   * Execute after delete hooks
   */
  async executeAfterDelete(
    context: MTPCContext,
    id: string,
    deleted: T
  ): Promise<void> {
    for (const hook of this.hooks.afterDelete ?? []) {
      await hook(context, id, deleted);
    }
  }

  /**
   * Execute before list hooks
   */
  async executeBeforeList(
    context: MTPCContext,
    options: QueryOptions
  ): Promise<HookResult<QueryOptions>> {
    let currentOptions = options;

    for (const hook of this.hooks.beforeList ?? []) {
      const result = await hook(context, currentOptions);
      
      if (!result.proceed) {
        return result;
      }
      
      if (result.data !== undefined) {
        currentOptions = result.data;
      }
    }

    return { proceed: true, data: currentOptions };
  }

  /**
   * Execute after list hooks
   */
  async executeAfterList(
    context: MTPCContext,
    options: QueryOptions,
    results: T[]
  ): Promise<T[]> {
    let currentResults = results;

    for (const hook of this.hooks.afterList ?? []) {
      currentResults = await hook(context, options, currentResults);
    }

    return currentResults;
  }

  /**
   * Execute filter query hooks
   */
  async executeFilterQuery(
    context: MTPCContext,
    baseFilters: FilterCondition[]
  ): Promise<FilterCondition[]> {
    let currentFilters = baseFilters;

    for (const hook of this.hooks.filterQuery ?? []) {
      currentFilters = await hook(context, currentFilters);
    }

    return currentFilters;
  }
}

/**
 * Create a hook executor
 */
export function createHookExecutor<T>(hooks: ResourceHooks<T>): HookExecutor<T> {
  return new HookExecutor(hooks);
}
