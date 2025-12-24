import type { GlobalHooksManager } from '../hooks/global.js';
import type { UnifiedRegistry } from '../registry/unified-registry.js';
import type {
  GlobalHooks,
  PluginContext,
  PolicyDefinition,
  PolicyEngine,
  ResourceDefinition,
  ResourceHooks,
} from '../types/index.js';

/**
 * 创建插件上下文
 * 为插件提供访问核心功能的接口，包括注册资源、策略和钩子
 * 这是插件与 MTPC 核心系统交互的桥梁
 *
 * @param registry 统一注册表，提供资源、策略等的注册和查询功能
 * @param globalHooks 全局钩子管理器，用于管理跨资源的全局钩子
 * @param policyEngine 策略引擎实例（可选），用于策略评估
 * @param permissionResolver 权限解析器函数（可选），用于解析主体权限
 * @returns 插件上下文对象，插件可以通过它访问核心功能
 *
 * @example
 * ```typescript
 * // 创建插件上下文
 * const context = createPluginContext(registry, globalHooks, policyEngine, permissionResolver);
 *
 * // 插件可以使用上下文注册资源
 * context.registerResource({
 *   name: 'customResource',
 *   schema: z.object({ ... })
 * });
 *
 * // 注册全局钩子
 * context.registerGlobalHooks({
 *   beforeAny: [async (ctx, next) => {
 *     console.log('Before any operation');
 *     await next();
 *   }]
 * });
 * ```
 */
export function createPluginContext(
  registry: UnifiedRegistry,
  globalHooks: GlobalHooksManager,
  policyEngine?: PolicyEngine,
  permissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>
): PluginContext {
  // 输入验证
  if (!registry) {
    throw new Error('registry 参数不能为空');
  }

  if (!globalHooks) {
    throw new Error('globalHooks 参数不能为空');
  }

  // 资源注册回调函数列表
  const resourceCallbacks: Array<(resource: ResourceDefinition) => void> = [];

  // 保存原始的 registerResource 方法
  const originalRegisterResource = registry.registerResource.bind(registry);

  // 包装 registerResource 以支持回调
  registry.registerResource = (resource: ResourceDefinition): void => {
    originalRegisterResource(resource);
    // 触发所有回调
    for (const callback of resourceCallbacks) {
      try {
        callback(resource);
      } catch (error) {
        console.error(`资源注册回调执行失败 (${resource.name}):`, error);
      }
    }
  };

  return {
    /**
     * 注册资源定义
     * 插件可以通过此方法向系统注册新的资源类型
     *
     * @param resource 资源定义对象，包含资源名称、模式、特性等
     *
     * @example
     * ```typescript
     * context.registerResource({
     *   name: 'user',
     *   schema: z.object({
     *     id: z.string(),
     *     name: z.string()
     *   }),
     *   features: {
     *     create: true,
     *     read: true,
     *     update: true,
     *     delete: false,
     *     list: true
     *   }
     * });
     * ```
     */
    registerResource(resource: ResourceDefinition): void {
      // 验证资源参数
      if (!resource) {
        throw new Error('resource 参数不能为空');
      }

      if (!resource.name || typeof resource.name !== 'string') {
        throw new Error('resource.name 必须是字符串');
      }

      registry.registerResource(resource);
    },

    /**
     * 注册策略定义
     * 插件可以通过此方法注册访问控制策略
     *
     * @param policy 策略定义对象，包含策略ID、条件、效果等
     *
     * @example
     * ```typescript
     * context.registerPolicy({
     *   id: 'admin-access',
     *   effect: 'allow',
     *   conditions: [
     *     { type: 'subject', field: 'role', operator: 'equals', value: 'admin' }
     *   ],
     *   permissions: ['*']
     * });
     * ```
     */
    registerPolicy(policy: PolicyDefinition): void {
      // 验证策略参数
      if (!policy) {
        throw new Error('policy 参数不能为空');
      }

      if (!policy.id || typeof policy.id !== 'string') {
        throw new Error('policy.id 必须是字符串');
      }

      registry.registerPolicy(policy);
    },

    /**
     * 注册全局钩子
     * 在所有资源操作前后执行的钩子函数
     *
     * @param hooks 全局钩子配置，包含 beforeAny、afterAny、onError
     *
     * @example
     * ```typescript
     * context.registerGlobalHooks({
     *   beforeAny: [
     *     async (ctx, next) => {
     *       console.log(`操作前: ${ctx.action}`);
     *       await next();
     *     }
     *   ],
     *   afterAny: [
     *     async (ctx, result) => {
     *       console.log(`操作后: ${ctx.action}`);
     *       return result;
     *     }
     *   ],
     *   onError: [
     *     async (ctx, error) => {
     *       console.error(`操作错误: ${error.message}`);
     *     }
     *   ]
     * });
     * ```
     */
    registerGlobalHooks(hooks: Partial<GlobalHooks>): void {
      // 验证钩子参数
      if (!hooks || typeof hooks !== 'object') {
        throw new Error('hooks 参数必须是对象');
      }

      // 注册 beforeAny 钩子
      if (hooks.beforeAny) {
        if (!Array.isArray(hooks.beforeAny)) {
          throw new Error('hooks.beforeAny 必须是数组');
        }
        for (const hook of hooks.beforeAny) {
          if (typeof hook !== 'function') {
            throw new Error('hooks.beforeAny 中的元素必须是函数');
          }
          globalHooks.addBeforeAny(hook);
        }
      }

      // 注册 afterAny 钩子
      if (hooks.afterAny) {
        if (!Array.isArray(hooks.afterAny)) {
          throw new Error('hooks.afterAny 必须是数组');
        }
        for (const hook of hooks.afterAny) {
          if (typeof hook !== 'function') {
            throw new Error('hooks.afterAny 中的元素必须是函数');
          }
          globalHooks.addAfterAny(hook);
        }
      }

      // 注册 onError 钩子
      if (hooks.onError) {
        if (!Array.isArray(hooks.onError)) {
          throw new Error('hooks.onError 必须是数组');
        }
        for (const hook of hooks.onError) {
          if (typeof hook !== 'function') {
            throw new Error('hooks.onError 中的元素必须是函数');
          }
          globalHooks.addOnError(hook);
        }
      }
    },

    /**
     * 扩展资源钩子
     * 为指定资源添加或覆盖钩子函数
     * 新钩子会追加到现有钩子之后，而不是替换
     * 使用深拷贝避免直接修改原对象，确保并发安全
     *
     * @param resourceName 资源名称
     * @param hooks 要添加的钩子配置
     * @typeParam T 资源的创建/更新数据结构类型
     *
     * @example
     * ```typescript
     * // 为用户资源添加自定义钩子
     * context.extendResourceHooks('user', {
     *   beforeCreate: [
     *     async (ctx, data) => {
     *       // 在创建用户前执行
     *       data.createdAt = new Date();
     *       return { proceed: true, data };
     *     }
     *   ],
     *   afterRead: [
     *     async (ctx, result) => {
     *       // 在读取用户后执行
     *       console.log(`读取用户: ${result.id}`);
     *       return result;
     *     }
     *   ]
     * });
     * ```
     */
    extendResourceHooks<T>(resourceName: string, hooks: Partial<ResourceHooks<T>>): void {
      // 输入验证
      if (!resourceName || typeof resourceName !== 'string') {
        throw new Error('resourceName 必须是字符串');
      }

      if (!hooks || typeof hooks !== 'object') {
        throw new Error('hooks 参数必须是对象');
      }

      const resource = registry.resources.get(resourceName);

      if (!resource) {
        throw new Error(`Resource not found: ${resourceName}`);
      }

      // 深拷贝资源对象以避免直接修改
      const clonedResource = JSON.parse(JSON.stringify(resource));

      // 合并现有钩子和新钩子
      const existingHooks = clonedResource.hooks || {};
      const mergedHooks = {
        beforeCreate: [...(existingHooks.beforeCreate ?? []), ...(hooks.beforeCreate ?? [])],
        afterCreate: [...(existingHooks.afterCreate ?? []), ...(hooks.afterCreate ?? [])],
        beforeRead: [...(existingHooks.beforeRead ?? []), ...(hooks.beforeRead ?? [])],
        afterRead: [...(existingHooks.afterRead ?? []), ...(hooks.afterRead ?? [])],
        beforeUpdate: [...(existingHooks.beforeUpdate ?? []), ...(hooks.beforeUpdate ?? [])],
        afterUpdate: [...(existingHooks.afterUpdate ?? []), ...(hooks.afterUpdate ?? [])],
        beforeDelete: [...(existingHooks.beforeDelete ?? []), ...(hooks.beforeDelete ?? [])],
        afterDelete: [...(existingHooks.afterDelete ?? []), ...(hooks.afterDelete ?? [])],
        beforeList: [...(existingHooks.beforeList ?? []), ...(hooks.beforeList ?? [])],
        afterList: [...(existingHooks.afterList ?? []), ...(hooks.afterList ?? [])],
        filterQuery: [...(existingHooks.filterQuery ?? []), ...(hooks.filterQuery ?? [])],
      };

      // 更新克隆资源的钩子配置
      clonedResource.hooks = mergedHooks;

      // 重新注册更新后的资源（通过注册表更新）
      registry.registerResource(clonedResource);
    },

    /**
     * 获取资源定义
     * 根据资源名称获取已注册的资源定义
     *
     * @param name 资源名称
     * @returns 资源定义对象，如果不存在则返回 undefined
     *
     * @example
     * ```typescript
     * const userResource = context.getResource('user');
     * if (userResource) {
     *   console.log(`找到资源: ${userResource.name}`);
     * }
     * ```
     */
    getResource(name: string): ResourceDefinition | undefined {
      // 输入验证
      if (!name || typeof name !== 'string') {
        throw new Error('name 必须是字符串');
      }

      return registry.resources.get(name);
    },

    /**
     * 获取策略定义
     * 根据策略ID获取已注册的策略定义
     *
     * @param id 策略ID
     * @returns 策略定义对象，如果不存在则返回 undefined
     *
     * @example
     * ```typescript
     * const adminPolicy = context.getPolicy('admin-access');
     * if (adminPolicy) {
     *   console.log(`找到策略: ${adminPolicy.id}`);
     * }
     * ```
     */
    getPolicy(id: string): PolicyDefinition | undefined {
      // 输入验证
      if (!id || typeof id !== 'string') {
        throw new Error('id 必须是字符串');
      }

      return registry.policies.get(id);
    },

    /**
     * 获取当前已注册的所有资源
     * @returns 资源定义数组（返回的是快照，后续注册的资源不会被包含）
     *
     * @example
     * ```typescript
     * // 在 install 中遍历所有已注册的资源
     * const resources = context.listResources();
     * for (const resource of resources) {
     *   console.log(`已注册资源: ${resource.name}`);
     *   if (resource.metadata?.dataScope?.enabled) {
     *     // 为启用了数据范围控制的资源添加钩子
     *   }
     * }
     * ```
     */
    listResources(): ResourceDefinition[] {
      return Array.from(registry.resources.list());
    },

    /**
     * 订阅资源注册事件
     * @param callback 当新资源注册时被调用的回调函数
     * @returns 取消订阅的函数
     *
     * @example
     * ```typescript
     * // 在 install 中订阅后续注册的资源
     * const unsubscribe = context.onResourceRegistered((resource) => {
     *   console.log(`新资源已注册: ${resource.name}`);
     *   // 为新资源添加钩子
     *   context.extendResourceHooks(resource.name, { ... });
     * });
     *
     * // 在 onDestroy 中取消订阅
     * onDestroy() {
     *   unsubscribe();
     * }
     * ```
     */
    onResourceRegistered(callback: (resource: ResourceDefinition) => void): () => void {
      if (typeof callback !== 'function') {
        throw new Error('callback 必须是函数');
      }

      resourceCallbacks.push(callback);

      // 返回取消订阅函数
      return () => {
        const index = resourceCallbacks.indexOf(callback);
        if (index > -1) {
          resourceCallbacks.splice(index, 1);
        }
      };
    },

    /** 策略引擎实例 */
    policyEngine,

    /** 权限解析器函数 */
    permissionResolver,
  };
}
