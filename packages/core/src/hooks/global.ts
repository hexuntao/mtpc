import type { GlobalHooks, HookResult, MTPCContext } from '../types/index.js';

/**
 * Global hooks manager
 */
export class GlobalHooksManager {
  private hooks: GlobalHooks = {
    beforeAny: [],
    afterAny: [],
    onError: [],
  };

  /**
   * Add before any hook
   */
  addBeforeAny(
    hook: (
      context: MTPCContext,
      operation: string,
      resourceName: string
    ) => Promise<HookResult> | HookResult
  ): void {
    this.hooks.beforeAny = [...(this.hooks.beforeAny ?? []), hook];
  }

  /**
   * Add after any hook
   */
  addAfterAny(
    hook: (
      context: MTPCContext,
      operation: string,
      resourceName: string,
      result: unknown
    ) => Promise<void> | void
  ): void {
    this.hooks.afterAny = [...(this.hooks.afterAny ?? []), hook];
  }

  /**
   * Add error hook
   */
  addOnError(
    hook: (
      context: MTPCContext,
      operation: string,
      resourceName: string,
      error: Error
    ) => Promise<void> | void
  ): void {
    this.hooks.onError = [...(this.hooks.onError ?? []), hook];
  }

  /**
   * Execute before any hooks
   */
  async executeBeforeAny(
    context: MTPCContext,
    operation: string,
    resourceName: string
  ): Promise<HookResult> {
    for (const hook of this.hooks.beforeAny ?? []) {
      const result = await hook(context, operation, resourceName);

      if (!result.proceed) {
        return result;
      }
    }

    return { proceed: true };
  }

  /**
   * Execute after any hooks
   */
  async executeAfterAny(
    context: MTPCContext,
    operation: string,
    resourceName: string,
    result: unknown
  ): Promise<void> {
    for (const hook of this.hooks.afterAny ?? []) {
      await hook(context, operation, resourceName, result);
    }
  }

  /**
   * Execute error hooks
   */
  async executeOnError(
    context: MTPCContext,
    operation: string,
    resourceName: string,
    error: Error
  ): Promise<void> {
    for (const hook of this.hooks.onError ?? []) {
      await hook(context, operation, resourceName, error);
    }
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks = {
      beforeAny: [],
      afterAny: [],
      onError: [],
    };
  }

  /**
   * Get hooks
   */
  getHooks(): GlobalHooks {
    return this.hooks;
  }
}

/**
 * Create global hooks manager
 */
export function createGlobalHooksManager(): GlobalHooksManager {
  return new GlobalHooksManager();
}
