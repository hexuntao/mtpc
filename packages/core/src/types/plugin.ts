import type { GlobalHooks, ResourceHooks } from './hooks.js';
import type { PolicyDefinition } from './policy.js';
import type { ResourceDefinition } from './resource.js';

/**
 * 插件元数据
 * 描述插件的基本信息
 *
 * @example
 * ```typescript
 * const auditPlugin: PluginMetadata = {
 *   name: 'audit-log',
 *   version: '1.0.0',
 *   description: '审计日志插件，记录所有权限相关操作',
 *   author: 'MTPC Team',
 *   dependencies: ['logging-core']
 * };
 *
 * const rbacPlugin: PluginMetadata = {
 *   name: 'rbac-extension',
 *   version: '2.1.0',
 *   description: '基于角色的访问控制扩展',
 *   author: 'MTPC Team'
 *   // 无依赖
 * };
 * ```
 */
export interface PluginMetadata {
  /** 插件名称（唯一标识符） */
  name: string;
  /** 插件版本号 */
  version: string;
  /** 插件描述（可选） */
  description?: string;
  /** 插件作者（可选） */
  author?: string;
  /** 依赖的其他插件名称列表（可选） */
  dependencies?: string[];
}

/**
 * 插件上下文
 * 插件与 MTPC 系统交互的接口
 *
 * @example
 * ```typescript
 * // 审计日志插件实现
 * const auditPlugin: PluginDefinition = {
 *   name: 'audit-log',
 *   version: '1.0.0',
 *   install(ctx) {
 *     // 注册全局钩子
 *     ctx.registerGlobalHooks({
 *       afterAny: async (mtpcContext, operation, resource, result) => {
 *         await auditLogger.log({
 *           tenantId: mtpcContext.tenant.id,
 *           userId: mtpcContext.subject.id,
 *           operation,
 *           resource,
 *           result,
 *           timestamp: new Date()
 *         });
 *       }
 *     });
 *   },
 *
 *   onInit(ctx) {
 *     // 初始化审计日志系统
 *     auditLogger.initialize();
 *   }
 * };
 *
 * // 资源扩展插件
 * const extensiblePlugin: PluginDefinition = {
 *   name: 'resource-extensions',
 *   version: '1.0.0',
 *   install(ctx) {
 *     // 扩展现有资源的钩子
 *     ctx.extendResourceHooks('user', {
 *       afterCreate: [sendWelcomeEmail],
 *       beforeUpdate: [validateEmailFormat]
 *     });
 *
 *     // 注册新资源
 *     ctx.registerResource(userProfileResource);
 *   }
 * };
 *
 * // 数据范围插件示例 - 使用 listResources 和 onResourceRegistered
 * const dataScopePlugin: PluginDefinition = {
 *   name: 'data-scope',
 *   version: '1.0.0',
 *   install(ctx) {
 *     // 为当前已注册的资源添加钩子
 *     for (const resource of ctx.listResources()) {
 *       if (resource.metadata?.dataScope?.enabled !== false) {
 *         ctx.extendResourceHooks(resource.name, {
 *           filterQuery: [createDataScopeFilter(resource.name)]
 *         });
 *       }
 *     }
 *
 *     // 订阅后续注册的资源
 *     ctx.onResourceRegistered((resource) => {
 *       if (resource.metadata?.dataScope?.enabled !== false) {
 *         ctx.extendResourceHooks(resource.name, {
 *           filterQuery: [createDataScopeFilter(resource.name)]
 *         });
 *       }
 *     });
 *   }
 * };
 * ```
 */
export interface PluginContext {
  /** 注册资源定义 */
  registerResource(resource: ResourceDefinition): void;
  /** 注册策略定义 */
  registerPolicy(policy: PolicyDefinition): void;
  /** 注册全局钩子 */
  registerGlobalHooks(hooks: Partial<GlobalHooks>): void;
  /** 扩展指定资源的钩子 */
  extendResourceHooks<T>(resourceName: string, hooks: Partial<ResourceHooks<T>>): void;
  /** 获取资源定义（可选） */
  getResource(name: string): ResourceDefinition | undefined;
  /** 获取策略定义（可选） */
  getPolicy(id: string): PolicyDefinition | undefined;
  /**
   * 获取当前已注册的所有资源
   * @returns 资源定义数组（返回的是快照，后续注册的资源不会被包含）
   *
   * @example
   * ```typescript
   * // 在 install 中遍历所有已注册的资源
   * const resources = ctx.listResources();
   * for (const resource of resources) {
   *   console.log(`已注册资源: ${resource.name}`);
   *   if (resource.metadata?.dataScope?.enabled) {
   *     // 为启用了数据范围控制的资源添加钩子
   *   }
   * }
   * ```
   */
  listResources(): ResourceDefinition[];
  /**
   * 订阅资源注册事件
   * @param callback 当新资源注册时被调用的回调函数
   * @returns 取消订阅的函数
   *
   * @example
   * ```typescript
   * // 在 install 中订阅后续注册的资源
   * const unsubscribe = ctx.onResourceRegistered((resource) => {
   *   console.log(`新资源已注册: ${resource.name}`);
   *   // 为新资源添加钩子
   *   ctx.extendResourceHooks(resource.name, { ... });
   * });
   *
   * // 在 onDestroy 中取消订阅
   * onDestroy() {
   *   unsubscribe();
   * }
   * ```
   */
  onResourceRegistered(callback: (resource: ResourceDefinition) => void): () => void;
}

/**
 * 插件生命周期钩子
 * 定义插件在各个生命周期阶段的行为
 *
 * @example
 * ```typescript
 * const fullLifecyclePlugin: PluginDefinition = {
 *   name: 'full-lifecycle',
 *   version: '1.0.0',
 *
 *   // 注册阶段 - 立即执行，用于注册钩子、资源等
 *   onRegister(ctx) {
 *     console.log('插件已注册');
 *     // 可以访问 ctx，但此时插件尚未安装
 *   },
 *
 *   // 安装阶段 - 在 init() 时调用，用于初始化资源
 *   install(ctx) {
 *     console.log('插件正在安装...');
 *     // 注册资源、策略、钩子等
 *   },
 *
 *   // 初始化阶段 - 安装完成后调用，用于建立连接等
 *   onInit(ctx) {
 *     console.log('插件已初始化');
 *     // 建立数据库连接、启动服务等
 *   },
 *
 *   // 销毁阶段 - 在系统关闭时调用（可选）
 *   onDestroy() {
 *     console.log('插件正在销毁...');
 *     // 清理资源、关闭连接等
 *   }
 * };
 * ```
 */
export interface PluginLifecycle {
  /** 注册钩子 - 插件注册时立即执行 */
  onRegister?(context: PluginContext): void | Promise<void>;
  /** 安装钩子 - init() 时调用，用于安装插件 */
  onInit?(context: PluginContext): void | Promise<void>;
  /** 销毁钩子 - 系统关闭时调用（可选） */
  onDestroy?(): void | Promise<void>;
}

/**
 * 插件定义
 * 描述一个完整的插件
 *
 * @example
 * ```typescript
 * // 简单插件示例
 * const simplePlugin: PluginDefinition = {
 *   name: 'simple-plugin',
 *   version: '1.0.0',
 *   description: '一个简单的示例插件',
 *   install(ctx) {
 *     // 插件安装逻辑
 *   }
 * };
 *
 * // 复杂插件示例
 * const complexPlugin: PluginDefinition = {
 *   name: 'complex-plugin',
 *   version: '2.0.0',
 *   description: '功能完整的插件',
 *   author: 'MTPC Team',
 *   dependencies: ['audit-log', 'logging-core'],
 *   install(ctx) {
 *     // 安装逻辑
 *   },
 *   onInit(ctx) {
 *     // 初始化逻辑
 *   },
 *   onDestroy() {
 *     // 销毁逻辑
 *   }
 * };
 *
 * // 无依赖插件
 * const independentPlugin: PluginDefinition = {
 *   name: 'independent',
 *   version: '1.0.0',
 *   install(ctx) {
 *     ctx.registerResource(customResource);
 *   }
 * };
 * ```
 */
export interface PluginDefinition extends PluginMetadata, PluginLifecycle {
  /** 安装方法 - 必须实现 */
  install(context: PluginContext): void | Promise<void>;
  /** 插件自定义状态（可选），可在 getPlugin 返回的实例中访问 */
  state?: unknown;
}

/**
 * 插件实例
 * 表示已安装的插件实例状态
 *
 * @example
 * ```typescript
 * // 获取插件实例
 * const pluginInstance = pluginManager.get('audit-log');
 *
 * if (pluginInstance) {
 *   console.log('插件名称:', pluginInstance.metadata.name);
 *   console.log('插件版本:', pluginInstance.metadata.version);
 *   console.log('是否已安装:', pluginInstance.installed);
 *   console.log('是否已初始化:', pluginInstance.initialized);
 *
 *   if (pluginInstance.metadata.author) {
 *     console.log('插件作者:', pluginInstance.metadata.author);
 *   }
 *
 *   if (pluginInstance.metadata.dependencies) {
 *     console.log('插件依赖:', pluginInstance.metadata.dependencies);
 *   }
 * }
 * ```
 */
export interface PluginInstance {
  /** 插件元数据 */
  readonly metadata: PluginMetadata;
  /** 是否已安装 */
  readonly installed: boolean;
  /** 是否已初始化 */
  readonly initialized: boolean;
  /** 插件自定义状态 */
  readonly state?: unknown;
}

/**
 * 插件管理器接口
 * 定义插件管理的核心操作
 *
 * @example
 * ```typescript
 * // 使用插件管理器
 * const pluginManager: PluginManager = createPluginManager(pluginContext);
 *
 * // 注册插件
 * pluginManager.register(auditPlugin);
 * pluginManager.register(rbacPlugin);
 * pluginManager.register(customPlugin);
 *
 * // 安装单个插件
 * await pluginManager.install('audit-log');
 *
 * // 安装所有插件（按依赖顺序）
 * await pluginManager.installAll();
 *
 * // 获取插件实例
 * const auditInstance = pluginManager.get('audit-log');
 * if (auditInstance) {
 *   console.log('审计插件已安装:', auditInstance.installed);
 * }
 *
 * // 检查插件状态
 * const isInstalled = pluginManager.isInstalled('rbac-plugin');
 * console.log('RBAC 插件是否已安装:', isInstalled);
 *
 * // 列出所有插件
 * const allPlugins = pluginManager.list();
 * console.log('已注册插件数量:', allPlugins.length);
 *
 * // 卸载插件
 * await pluginManager.uninstall('custom-plugin');
 * ```
 */
export interface PluginManager {
  /** 注册插件 */
  register(plugin: PluginDefinition): void;
  /** 安装指定插件 */
  install(pluginName: string): Promise<void>;
  /** 安装所有插件（按依赖顺序） */
  installAll(): Promise<void>;
  /** 卸载指定插件 */
  uninstall(pluginName: string): Promise<void>;
  /** 获取插件实例 */
  get(pluginName: string): PluginInstance | undefined;
  /** 列出所有插件实例 */
  list(): PluginInstance[];
  /** 检查插件是否已安装 */
  isInstalled(pluginName: string): boolean;
}
