import type { GlobalHooks, HookResult, MTPCContext } from '../types/index.js';

/**
 * 全局钩子管理器
 * 管理整个应用程序范围内的钩子，这些钩子在所有资源操作时都会触发
 * 用于实现横切关注点，如日志记录、审计、监控等
 *
 * @example
 * ```typescript
 * const globalHooks = createGlobalHooksManager();
 *
 * // 添加全局日志钩子
 * globalHooks.addBeforeAny(async (ctx, operation, resource) => {
 *   console.log(`操作 ${operation} 即将在资源 ${resource} 上执行`);
 *   return { proceed: true };
 * });
 *
 * // 添加全局审计钩子
 * globalHooks.addAfterAny(async (ctx, operation, resource, result) => {
 *   await auditLogger.log({
 *     userId: ctx.subject.id,
 *     operation,
 *     resource,
 *     result,
 *     timestamp: new Date()
 *   });
 * });
 * ```
 */
export class GlobalHooksManager {
  /** 全局钩子集合 */
  private hooks: GlobalHooks = {
    beforeAny: [],  // 操作前钩子
    afterAny: [],   // 操作后钩子
    onError: [],    // 错误钩子
  };

  /**
   * 添加操作前钩子
   * 在任何资源操作之前都会执行的钩子
   *
   * @param hook 要添加的钩子函数
   *
   * @example
   * ```typescript
   * globalHooks.addBeforeAny(async (context, operation, resourceName) => {
   *   // 记录操作日志
   *   await logger.info(`用户 ${context.subject.id} 即将执行 ${operation} 操作`);
   *
   *   // 检查全局限制
   *   const isAllowed = await checkGlobalLimits(context);
   *   if (!isAllowed) {
   *     return { proceed: false, error: '超出全局限制' };
   *   }
   *
   *   return { proceed: true };
   * });
   * ```
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
   * 添加操作后钩子
   * 在任何资源操作成功完成后执行的钩子
   *
   * @param hook 要添加的钩子函数
   *
   * @example
   * ```typescript
   * globalHooks.addAfterAny(async (context, operation, resourceName, result) => {
   *   // 记录成功日志
   *   await logger.info(`用户 ${context.subject.id} 成功执行了 ${operation} 操作`);
   *
   *   // 更新统计信息
   *   await metrics.increment(`operations.${operation}`);
   *
   *   // 发送通知
   *   await notificationService.send({
   *     type: 'operation_success',
   *     operation,
   *     resource: resourceName,
   *     userId: context.subject.id
   *   });
   * });
   * ```
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
   * 添加错误钩子
   * 在任何资源操作失败时执行的钩子
   *
   * @param hook 要添加的钩子函数
   *
   * @example
   * ```typescript
   * globalHooks.addOnError(async (context, operation, resourceName, error) => {
   *   // 记录错误日志
   *   await logger.error(`用户 ${context.subject.id} 在执行 ${operation} 操作时出错`, {
   *     error: error.message,
   *     stack: error.stack,
   *     resource: resourceName
   *   });
   *
   *   // 发送错误告警
   *   await alertService.send({
   *     level: 'error',
   *     message: `操作失败: ${operation}`,
   *     userId: context.subject.id,
   *     error: error.message
   *   });
   *
   *   // 更新错误统计
   *   await metrics.increment(`errors.${operation}`);
   * });
   * ```
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
   * 执行操作前钩子
   * 按顺序执行所有 beforeAny 钩子，任何一个钩子返回 proceed: false 都会阻止操作
   *
   * @param context MTPC 上下文
   * @param operation 要执行的操作（create/read/update/delete/list）
   * @param resourceName 资源名称
   * @returns 钩子执行结果
   */
  async executeBeforeAny(
    context: MTPCContext,
    operation: string,
    resourceName: string
  ): Promise<HookResult> {
    try {
      for (const hook of this.hooks.beforeAny ?? []) {
        const result = await hook(context, operation, resourceName);

        if (!result.proceed) {
          return result;
        }
      }

      return { proceed: true };
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行操作后钩子
   * 在操作成功完成后按顺序执行所有 afterAny 钩子
   *
   * @param context MTPC 上下文
   * @param operation 已执行的操作
   * @param resourceName 资源名称
   * @param result 操作结果
   */
  async executeAfterAny(
    context: MTPCContext,
    operation: string,
    resourceName: string,
    result: unknown
  ): Promise<void> {
    try {
      for (const hook of this.hooks.afterAny ?? []) {
        await hook(context, operation, resourceName, result);
      }
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行错误钩子
   * 在操作失败时按顺序执行所有 onError 钩子
   *
   * @param context MTPC 上下文
   * @param operation 出错的操作
   * @param resourceName 资源名称
   * @param error 错误对象
   */
  async executeOnError(
    context: MTPCContext,
    operation: string,
    resourceName: string,
    error: Error
  ): Promise<void> {
    try {
      for (const hook of this.hooks.onError ?? []) {
        await hook(context, operation, resourceName, error);
      }
    } catch (hookError) {
      // 错误钩子执行失败，记录但不抛出，避免掩盖原始错误
      console.error('Error hook execution failed:', hookError);
    }
  }

  /**
   * 清除所有钩子
   * 重置所有钩子为空数组，通常用于测试或重新初始化
   */
  clear(): void {
    this.hooks = {
      beforeAny: [],
      afterAny: [],
      onError: [],
    };
  }

  /**
   * 获取钩子集合
   * 返回当前所有的全局钩子（深拷贝副本，防止外部直接修改）
   *
   * @returns 全局钩子集合
   */
  getHooks(): GlobalHooks {
    // 返回深拷贝，防止外部直接修改
    return JSON.parse(JSON.stringify(this.hooks));
  }
}

/**
 * 创建全局钩子管理器
 * 便捷工厂函数，用于创建 GlobalHooksManager 实例
 *
 * @returns 全局钩子管理器实例
 *
 * @example
 * ```typescript
 * const globalHooks = createGlobalHooksManager();
 *
 * // 添加审计钩子
 * globalHooks.addAfterAny(async (ctx, op, resource, result) => {
 *   await auditLogger.log({ userId: ctx.subject.id, operation: op, resource });
 * });
 * ```
 */
export function createGlobalHooksManager(): GlobalHooksManager {
  return new GlobalHooksManager();
}
