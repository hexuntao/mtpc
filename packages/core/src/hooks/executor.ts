import type {
  FilterCondition,
  HookResult,
  MTPCContext,
  QueryOptions,
  ResourceHooks,
} from '../types/index.js';

/**
 * 资源钩子执行器
 * 负责按顺序执行资源的所有钩子函数，支持 before/after 类型的钩子
 * 钩子可以修改数据、阻止操作执行或执行额外的业务逻辑
 *
 * @example
 * ```typescript
 * // 创建钩子执行器
 * const executor = new HookExecutor<User>({
 *   beforeCreate: [validateEmail, setDefaultRole],
 *   afterCreate: [sendWelcomeEmail, logActivity]
 * });
 *
 * // 执行创建前钩子
 * const result = await executor.executeBeforeCreate(context, userData);
 * if (result.proceed) {
 *   // 继续执行创建操作
 *   const created = await createUser(result.data);
 *   // 执行创建后钩子
 *   await executor.executeAfterCreate(context, userData, created);
 * }
 * ```
 */
export class HookExecutor<T = unknown> {
  /** 资源钩子集合 */
  private hooks: ResourceHooks<T>;

  /**
   * 创建钩子执行器
   * @param hooks 资源钩子配置
   */
  constructor(hooks: ResourceHooks<T>) {
    this.hooks = hooks;
  }

  /**
   * 执行创建前钩子
   * 按顺序执行所有 beforeCreate 钩子，每个钩子都可以：
   * - 修改要创建的数据
   * - 阻止创建操作（通过返回 proceed: false）
   * - 验证数据并抛出错误
   *
   * @param context MTPC 上下文
   * @param data 要创建的数据
   * @returns 钩子执行结果，包含最终数据和是否继续执行
   *
   * @example
   * ```typescript
   * const result = await executor.executeBeforeCreate(context, userData);
   * if (!result.proceed) {
   *   throw new Error(result.error || '创建被阻止');
   * }
   * const finalData = result.data;
   * ```
   */
  async executeBeforeCreate(context: MTPCContext, data: T): Promise<HookResult<T>> {
    let currentData = data;
    const executedHooks: Array<{ hook: any; modifiedData: any }> = [];

    try {
      for (const hook of this.hooks.beforeCreate ?? []) {
        const result = await hook(context, currentData);

        if (!result.proceed) {
          return result;
        }

        if (result.data !== undefined) {
          // 记录修改前的数据，用于回滚
          executedHooks.push({ hook, modifiedData: currentData });
          currentData = result.data;
        }
      }

      return { proceed: true, data: currentData };
    } catch (error) {
      // 钩子执行失败，抛出错误
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行创建后钩子
   * 在资源创建完成后执行，通常用于：
   * - 发送通知邮件
   * - 记录审计日志
   * - 触发异步任务
   * - 关联数据创建
   *
   * @param context MTPC 上下文
   * @param data 原始创建数据
   * @param created 创建后的完整数据
   *
   * @example
   * ```typescript
   * await executor.executeAfterCreate(context, userInput, createdUser);
   * // 可以发送欢迎邮件、更新缓存、记录日志等
   * ```
   */
  async executeAfterCreate(context: MTPCContext, data: T, created: T): Promise<void> {
    for (const hook of this.hooks.afterCreate ?? []) {
      await hook(context, data, created);
    }
  }

  /**
   * 执行读取前钩子
   * 在读取资源前执行钩子，可以：
   * - 修改要读取的资源 ID
   * - 阻止读取操作（例如权限不足）
   * - 添加额外的验证逻辑
   *
   * @param context MTPC 上下文
   * @param id 要读取的资源 ID
   * @returns 钩子执行结果
   *
   * @example
   * ```typescript
   * // 检查用户是否有权限读取此资源
   * const result = await executor.executeBeforeRead(context, resourceId);
   * if (!result.proceed) {
   *   throw new ForbiddenError('无权访问此资源');
   * }
   * ```
   */
  async executeBeforeRead(context: MTPCContext, id: string): Promise<HookResult<string>> {
    let currentId = id;

    try {
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
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行读取后钩子
   * 在资源读取后执行，可以：
   * - 过滤或转换返回的数据
   * - 添加计算字段
   * - 记录访问日志
   * - 脱敏敏感数据
   *
   * @param context MTPC 上下文
   * @param id 资源 ID
   * @param data 读取到的资源数据（可能为 null）
   * @returns 处理后的资源数据
   */
  async executeAfterRead(context: MTPCContext, id: string, data: T | null): Promise<T | null> {
    let currentData = data;

    try {
      for (const hook of this.hooks.afterRead ?? []) {
        currentData = await hook(context, id, currentData);
      }

      return currentData;
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行更新前钩子
   * 在资源更新前执行，可以：
   * - 验证更新数据的合法性
   * - 修改更新内容
   * - 阻止更新操作（例如资源被锁定）
   * - 添加业务规则检查
   *
   * @param context MTPC 上下文
   * @param id 资源 ID
   * @param data 要更新的数据（部分更新）
   * @returns 钩子执行结果
   */
  async executeBeforeUpdate(
    context: MTPCContext,
    id: string,
    data: Partial<T>
  ): Promise<HookResult<Partial<T>>> {
    let currentData = data;

    try {
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
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行更新后钩子
   * 在资源更新完成后执行，可以：
   * - 清除相关缓存
   * - 触发索引更新
   * - 发送通知
   * - 记录审计日志
   * - 触发关联数据更新
   *
   * @param context MTPC 上下文
   * @param id 资源 ID
   * @param data 原始更新数据
   * @param updated 更新后的完整数据
   */
  async executeAfterUpdate(
    context: MTPCContext,
    id: string,
    data: Partial<T>,
    updated: T
  ): Promise<void> {
    try {
      for (const hook of this.hooks.afterUpdate ?? []) {
        await hook(context, id, data, updated);
      }
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行删除前钩子
   * 在资源删除前执行，可以：
   * - 检查是否有依赖关系
   * - 执行软删除（标记为已删除）
   * - 阻止删除操作（例如资源被保护）
   * - 备份要删除的数据
   *
   * @param context MTPC 上下文
   * @param id 要删除的资源 ID
   * @returns 钩子执行结果
   */
  async executeBeforeDelete(context: MTPCContext, id: string): Promise<HookResult<string>> {
    let currentId = id;

    try {
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
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行删除后钩子
   * 在资源删除后执行，可以：
   * - 清除相关缓存
   * - 删除关联数据
   * - 记录删除日志
   * - 发送删除通知
   * - 触发清理任务
   *
   * @param context MTPC 上下文
   * @param id 已删除的资源 ID
   * @param deleted 删除前的资源数据
   */
  async executeAfterDelete(context: MTPCContext, id: string, deleted: T): Promise<void> {
    try {
      for (const hook of this.hooks.afterDelete ?? []) {
        await hook(context, id, deleted);
      }
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行列表查询前钩子
   * 在列表查询前执行，可以：
   * - 修改查询选项（过滤条件、排序、分页）
   * - 添加默认过滤条件
   * - 阻止查询操作
   * - 记录查询日志
   *
   * @param context MTPC 上下文
   * @param options 查询选项
   * @returns 钩子执行结果
   */
  async executeBeforeList(
    context: MTPCContext,
    options: QueryOptions
  ): Promise<HookResult<QueryOptions>> {
    let currentOptions = options;

    try {
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
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行列表查询后钩子
   * 在列表查询后执行，可以：
   * - 过滤或转换返回结果
   * - 添加计算字段
   * - 脱敏敏感数据
   * - 记录查询统计
   * - 分页处理
   *
   * @param context MTPC 上下文
   * @param options 查询选项
   * @param results 查询结果列表
   * @returns 处理后的结果列表
   */
  async executeAfterList(context: MTPCContext, options: QueryOptions, results: T[]): Promise<T[]> {
    let currentResults = results;

    try {
      for (const hook of this.hooks.afterList ?? []) {
        currentResults = await hook(context, options, currentResults);
      }

      return currentResults;
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行过滤查询钩子
   * 在构建查询过滤条件时执行，可以：
   * - 添加全局过滤条件（例如租户隔离）
   * - 修改现有过滤条件
   * - 添加安全过滤（防止 SQL 注入）
   * - 根据用户权限调整过滤条件
   *
   * @param context MTPC 上下文
   * @param baseFilters 基础过滤条件列表
   * @returns 处理后的过滤条件列表
   */
  async executeFilterQuery(
    context: MTPCContext,
    baseFilters: FilterCondition[]
  ): Promise<HookResult<FilterCondition[]>> {
    let currentFilters = baseFilters;

    try {
      for (const hook of this.hooks.filterQuery ?? []) {
        const result = await hook(context, currentFilters);
        // 确保钩子返回 FilterCondition[]
        if (Array.isArray(result)) {
          currentFilters = result;
        } else {
          throw new Error('Filter query hook must return FilterCondition[]');
        }
      }

      return { proceed: true, data: currentFilters };
    } catch (error) {
      throw new Error(`Hook execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 创建钩子执行器
 * 便捷工厂函数，用于创建 HookExecutor 实例
 *
 * @param hooks 资源钩子配置
 * @returns 钩子执行器实例
 *
 * @example
 * ```typescript
 * const executor = createHookExecutor({
 *   beforeCreate: [validateData],
 *   afterCreate: [logActivity]
 * });
 * ```
 */
export function createHookExecutor<T>(hooks: ResourceHooks<T>): HookExecutor<T> {
  return new HookExecutor(hooks);
}
