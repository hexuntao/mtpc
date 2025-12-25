import { createGlobalHooksManager, type GlobalHooksManager } from './hooks/global.js';
import { PermissionChecker } from './permission/checker.js';
import { createPluginContext } from './plugin/context.js';
import { DefaultPluginManager } from './plugin/manager.js';
import { DefaultPolicyEngine } from './policy/engine.js';
import { createUnifiedRegistry, type UnifiedRegistry } from './registry/unified-registry.js';
import { createTenantManager, type TenantManager } from './tenant/manager.js';
import { ANONYMOUS_SUBJECT, createContext } from './types/context.js';
import type {
  MTPCContext,
  MultiTenantOptions,
  PermissionCheckContext,
  PermissionCheckResult,
  PluginDefinition,
  PolicyDefinition,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  ResourceDefinition,
  SubjectContext,
  TenantContext,
} from './types/index.js';

/**
 * MTPC 配置选项
 * 用于初始化多租户权限核心实例的配置参数
 */
export interface MTPCOptions {
  /**
   * 多租户配置选项
   * 包括租户隔离级别、解析器等设置
   */
  multiTenant?: MultiTenantOptions;

  /**
   * 默认权限解析器
   * 用于将 (tenantId, subjectId) 映射为权限集合
   *
   * **必填字段** - MTPC 需要知道如何解析主体权限
   * 如果未提供，构造函数将抛出错误
   *
   * @param tenantId 租户ID
   * @param subjectId 主体ID（用户、服务等）
   * @returns 权限代码集合，如 ['user:read', 'user:write']
   *
   * @example
   * ```typescript
   * // 使用 RBAC 扩展
   * import { createRBACPlugin } from '@mtpc/rbac';
   *
   * const rbac = createRBACPlugin();
   * const mtpc = createMTPC({
   *   defaultPermissionResolver: rbac.state.evaluator.getPermissions.bind(rbac.state.evaluator)
   * });
   * ```
   */
  defaultPermissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>;
}

/**
 * MTPC - Multi-Tenant Permission Core (多租户权限核心)
 *
 * 这是 MTPC 库的**主入口类**，负责协调所有子系统：
 * - 注册表系统 (Registry): 统一管理资源、权限、策略
 * - 策略引擎 (PolicyEngine): 评估权限策略
 * - 权限检查器 (PermissionChecker): 执行权限校验
 * - 插件系统 (PluginManager): 管理插件生命周期
 * - 钩子系统 (GlobalHooksManager): 处理横切关注点
 * - 租户管理 (TenantManager): 多租户上下文管理
 *
 * **核心设计理念**：
 * 1. **组合优于继承**: 通过组合各个子系统扩展功能
 * 2. **单一职责**: 每个子系统专注自己的职责
 * 3. **开放封闭**: 对扩展开放（插件），对修改封闭（冻结机制）
 * 4. **依赖倒置**: 依赖抽象而非具体实现
 */
export class MTPC {
  // ========== 只读子系统引用（暴露给外部使用）==========

  /** 注册表系统 - 统一管理所有注册信息（资源、权限、策略） */
  readonly registry: UnifiedRegistry;

  /** 策略引擎 - 负责评估权限策略条件 */
  readonly policyEngine: DefaultPolicyEngine;

  /** 权限检查器 - 执行具体的权限校验逻辑 */
  permissionChecker: PermissionChecker;

  /** 全局钩子管理器 - 管理横切关注点（审计、监控等） */
  readonly globalHooks: GlobalHooksManager;

  /** 插件管理器 - 负责插件的注册、安装、生命周期管理 */
  readonly plugins: DefaultPluginManager;

  /** 租户管理器 - 多租户上下文管理、缓存、存储抽象 */
  readonly tenants: TenantManager;

  // ========== 私有属性 ==========

  /** 标记 MTPC 实例是否已初始化（防止重复初始化） */
  private initialized = false;

  /** 权限解析器 - 将 (tenantId, subjectId) 映射为权限集合 */
  private permissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>;

  /**
   * 构造函数
   * 初始化所有子系统并建立依赖关系
   *
   * **初始化顺序**（重要）：
   * 1. 创建注册表系统
   * 2. 创建策略引擎
   * 3. 创建全局钩子管理器
   * 4. 创建租户管理器
   * 5. 创建插件上下文和插件管理器
   * 6. 创建权限检查器（注入权限解析器）
   *
   * @param options MTPC 配置选项
   */
  constructor(options: MTPCOptions = {}) {
    // 创建统一注册表（所有资源的单一事实源）
    this.registry = createUnifiedRegistry();

    // 创建策略引擎（负责权限策略评估）
    this.policyEngine = new DefaultPolicyEngine();

    // 创建全局钩子管理器（横切关注点）
    this.globalHooks = createGlobalHooksManager();

    // 创建租户管理器（多租户支持）
    this.tenants = createTenantManager();

    // 创建插件上下文和插件管理器
    // 插件上下文提供插件与系统交互的接口
    const pluginContext = createPluginContext(this.registry, this.globalHooks);
    this.plugins = new DefaultPluginManager(pluginContext);

    // 初始化 permissionResolver
    // 如果提供了 resolver，直接使用；否则设置为 undefined（需要在使用前设置）
    this.permissionResolver = options.defaultPermissionResolver;

    // 创建权限检查器
    // 注意：如果未设置 resolver，checkPermission 时会抛出错误
    this.permissionChecker = new PermissionChecker(
      this.permissionResolver ?? (async () => new Set())
    );
  }

  // ========== 资源注册方法 ==========

  /**
   * 注册单个资源
   * 这是 MTPC 的核心 API 之一，定义了系统中的权限控制对象
   *
   * **资源注册流程**：
   * 1. 验证资源定义的完整性和有效性
   * 2. 将资源添加到注册表
   * 3. 自动生成该资源对应的权限（CRUD + 自定义权限）
   * 4. 冻结注册表后不可再修改
   *
   * **示例**：
   * ```typescript
   * const userResource = defineResource({
   *   name: 'user',
   *   schema: z.object({ id: z.string(), name: z.string() }),
   *   features: { create: true, read: true, update: true, delete: true }
   * });
   * mtpc.registerResource(userResource);
   * // 自动生成权限: user:create, user:read, user:update, user:delete
   * ```
   *
   * @param resource 资源定义
   * @returns 返回 this 支持链式调用
   */
  registerResource(resource: ResourceDefinition): this {
    this.registry.registerResource(resource);
    return this;
  }

  /**
   * 批量注册多个资源
   * 内部调用 registerResource 逐个注册
   *
   * @param resources 资源定义数组
   * @returns 返回 this 支持链式调用
   */
  registerResources(resources: ResourceDefinition[]): this {
    this.registry.registerResources(resources);
    return this;
  }

  // ========== 策略注册方法 ==========

  /**
   * 注册权限策略
   * 策略定义了**何时**允许或拒绝权限
   *
   * **策略注册流程**：
   * 1. 验证策略定义的完整性
   * 2. 编译策略（转换为高效的运行时格式）
   * 3. 添加到注册表
   * 4. 添加到策略引擎
   *
   * **示例策略**：
   * ```typescript
   * mtpc.registerPolicy({
   *   id: 'only-business-hours',
   *   name: '仅工作时间访问',
   *   rules: [{
   *     permissions: ['*'], // 所有权限
   *     effect: 'allow',
   *     conditions: [{
   *       type: 'time',
   *       operator: 'between',
   *       value: { start: '09:00', end: '18:00' }
   *     }]
   *   }],
   *   priority: 'high',
   *   enabled: true
   * });
   * ```
   *
   * @param policy 策略定义
   * @returns 返回 this 支持链式调用
   */
  registerPolicy(policy: PolicyDefinition): this {
    this.registry.registerPolicy(policy);
    this.policyEngine.addPolicy(policy);
    return this;
  }

  /**
   * 批量注册多个策略
   * 内部调用 registerPolicy 逐个注册
   *
   * @param policies 策略定义数组
   * @returns 返回 this 支持链式调用
   */
  registerPolicies(policies: PolicyDefinition[]): this {
    for (const policy of policies) {
      this.registerPolicy(policy);
    }
    return this;
  }

  // ========== 插件系统方法 ==========

  /**
   * 注册插件
   * 插件是扩展 MTPC 功能的主要方式
   *
   * **插件能力**：
   * - 注册自定义资源
   * - 注册自定义策略
   * - 添加全局钩子
   * - 扩展资源钩子
   * - 提供外部服务集成
   *
   * **插件生命周期**：
   * 1. register - 注册插件（此时不执行）
   * 2. init - 初始化阶段（安装插件）
   * 3. 运行期 - 插件功能生效
   * 4. destroy - 销毁阶段（可选）
   *
   * **示例插件**：
   * ```typescript
   * const auditPlugin: PluginDefinition = {
   *   name: 'audit-log',
   *   version: '1.0.0',
   *   install(ctx) {
   *     ctx.registerGlobalHooks({
   *       afterAny: async (ctx, op, resource, result) => {
   *         await logAuditTrail(ctx, op, resource, result);
   *       }
   *     });
   *   }
   * };
   * mtpc.use(auditPlugin);
   * ```
   *
   * @param plugin 插件定义
   * @returns 返回 this 支持链式调用
   */
  use(plugin: PluginDefinition): this {
    this.plugins.register(plugin);
    return this;
  }

  // ========== 初始化方法 ==========

  /**
   * 初始化 MTPC 实例
   * 这是**必须**调用的方法，用于完成系统启动
   *
   * **初始化流程**：
   * 1. 检查是否已初始化（防重复）
   * 2. 安装所有注册的插件（按依赖顺序）
   * 3. 冻结注册表（确保运行时不可变）
   * 4. 标记为已初始化
   *
   * **重要**：初始化完成后，注册表将被冻结，此时无法再注册新资源、策略或插件
   * 这是为了确保运行时的稳定性和一致性
   *
   * **使用建议**：
   * - 在应用启动时调用
   * - 只调用一次
   * - 在调用前完成所有资源、策略、插件的注册
   *
   * @returns 返回 this 支持链式调用
   */
  async init(): Promise<this> {
    // 防重复初始化
    if (this.initialized) {
      return this;
    }

    // 安装所有插件（拓扑排序，确保依赖先安装）
    await this.plugins.installAll();

    // 冻结注册表（运行时安全措施）
    this.registry.freeze();

    // 标记为已初始化
    this.initialized = true;

    return this;
  }

  /**
   * 获取已安装的插件实例
   * 用于访问插件的状态和功能
   *
   * **使用场景**：
   * - 访问 RBAC 扩展的角色管理器
   * - 访问 Audit 扩展的审计日志
   * - 获取扩展的内部状态
   *
   * **注意**：
   * - 必须在 init() 之后调用
   * - 如果插件未安装，返回 undefined
   *
   * @param pluginName 插件名称（如 '@mtpc/rbac'）
   * @returns 插件实例，包含 state 和生命周期信息
   *
   * @example
   * ```typescript
   * await mtpc.init();
   *
   * // 获取 RBAC 插件
   * const rbac = mtpc.getPlugin('@mtpc/rbac');
   * if (rbac) {
   *   const { roles, bindings } = rbac.state;
   *   await roles.createRole('tenant-001', { name: 'editor' });
   * }
   * ```
   */
  getPlugin(pluginName: string) {
    return this.plugins.get(pluginName);
  }

  // ========== 上下文创建方法 ==========

  /**
   * 创建请求上下文
   * 用于权限检查和策略评估的上下文封装
   *
   * **上下文组成**：
   * - tenant: 租户上下文（多租户隔离）
   * - subject: 主体上下文（谁在执行操作）
   * - request: 请求上下文（时间、IP、路径等）
   *
   * **使用场景**：
   * - HTTP 请求处理
   * - 消息队列处理
   * - 定时任务执行
   * - 内部服务调用
   *
   * **示例**：
   * ```typescript
   * // HTTP 中间件中
   * const mtpcContext = mtpc.createContext(
   *   tenantContext,
   *   { id: userId, type: 'user', roles: ['admin'] }
   * );
   *
   * // 权限检查
   * const result = await mtpc.checkPermission({
   *   ...mtpcContext,
   *   resource: 'user',
   *   action: 'delete'
   * });
   * ```
   *
   * @param tenant 租户上下文
   * @param subject 主体上下文（可选，默认为匿名用户）
   * @returns 完整的 MTPC 上下文
   */
  createContext(tenant: TenantContext, subject?: SubjectContext): MTPCContext {
    return createContext({
      tenant,
      subject: subject ?? ANONYMOUS_SUBJECT,
    });
  }

  /**
   * 设置权限解析器
   *
   * **使用场景**：
   * - 在 init() 之后动态切换权限模型
   * - RBAC/ABAC 等扩展集成
   *
   * **注意**：
   * - 必须在调用 checkPermission 之前设置
   * - 会同时更新 PermissionChecker
   *
   * @param resolver 权限解析器函数
   * @returns 返回 this 支持链式调用
   * @throws 如果 resolver 为空
   */
  setPermissionResolver(
    resolver: (tenantId: string, subjectId: string) => Promise<Set<string>>
  ): this {
    if (!resolver) {
      throw new Error('PermissionResolver 不能为空');
    }

    this.permissionResolver = resolver;
    this.permissionChecker = new PermissionChecker(resolver);
    return this;
  }

  /**
   * 获取当前权限解析器
   *
   * **用途**：
   * - 调试和诊断
   * - 验证 RBAC 扩展是否正确集成
   *
   * @returns 当前权限解析器，如果未设置则返回 undefined
   */
  getPermissionResolver():
    | ((tenantId: string, subjectId: string) => Promise<Set<string>>)
    | undefined {
    return this.permissionResolver;
  }

  // ========== 权限检查方法 ==========

  /**
   * 检查权限（返回结果）
   * 核心权限检查 API，返回详细的检查结果
   *
   * **检查流程**：
   * 1. 解析权限代码（resource:action）
   * 2. 系统主体直接允许
   * 3. 主体直接权限检查
   * 4. 调用权限解析器获取权限集合
   * 5. 通配符权限检查 (*, resource:*)
   * 6. 具体权限匹配
   * 7. 默认拒绝
   *
   * **返回结果包含**：
   * - allowed: 是否允许
   * - permission: 检查的权限代码
   * - reason: 允许/拒绝的原因
   * - evaluationTime: 评估耗时（毫秒）
   *
   * @param context 权限检查上下文
   * @returns 权限检查结果
   */
  async checkPermission(context: PermissionCheckContext): Promise<PermissionCheckResult> {
    return this.permissionChecker.check(context);
  }

  /**
   * 检查权限（拒绝时抛出异常）
   * 便捷方法，权限不足时直接抛出 PermissionDeniedError
   *
   * **使用场景**：
   * - HTTP 中间件（快速失败）
   * - 业务逻辑中（清晰的权限控制点）
   *
   * **示例**：
   * ```typescript
   * // 业务逻辑中
   * await mtpc.requirePermission({
   *   ...context,
   *   resource: 'order',
   *   action: 'delete'
   * });
   *
   * // 后续代码只有在权限通过时才执行
   * await deleteOrder(orderId);
   * ```
   *
   * @param context 权限检查上下文
   * @returns 无返回值，权限不足时抛出异常
   * @throws PermissionDeniedError 权限不足时
   */
  async requirePermission(context: PermissionCheckContext): Promise<void> {
    return this.permissionChecker.checkOrThrow(context);
  }

  // ========== 策略评估方法 ==========

  /**
   * 评估策略
   * 直接调用策略引擎进行条件评估
   *
   * **与 checkPermission 的区别**：
   * - checkPermission: 完整的权限检查流程（包括权限解析）
   * - evaluatePolicy: 仅评估策略条件（不包含权限解析）
   *
   * **使用场景**：
   * - 调试策略问题
   * - 策略解释功能
   * - 策略覆盖率测试
   * - 自定义权限检查逻辑
   *
   * @param context 策略评估上下文
   * @returns 策略评估结果
   */
  async evaluatePolicy(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    return this.policyEngine.evaluate(context);
  }

  // ========== 元数据查询方法 ==========

  /**
   * 获取所有权限代码
   * 返回对象形式，键为权限代码，值为权限描述
   *
   * **用途**：
   * - 生成权限管理界面
   * - API 文档生成
   * - 权限矩阵展示
   *
   * @returns 权限代码对象，如 { 'user:create': '创建用户', 'user:read': '查看用户' }
   */
  getPermissionCodes(): Record<string, string> {
    return this.registry.getPermissionCodesObject();
  }

  /**
   * 获取所有资源名称
   * 返回已注册资源的名称列表
   *
   * @returns 资源名称数组，如 ['user', 'order', 'product']
   */
  getResourceNames(): string[] {
    return this.registry.resources.names();
  }

  /**
   * 根据名称获取资源定义
   * 用于动态资源访问和反射
   *
   * @param name 资源名称
   * @returns 资源定义或 undefined（如果不存在）
   */
  getResource(name: string): ResourceDefinition | undefined {
    return this.registry.resources.get(name);
  }

  /**
   * 导出元数据供 UI 使用
   * 包含资源信息、权限、特性等，用于生成管理界面
   *
   * **包含内容**：
   * - 资源列表（名称、显示名称）
   * - 每个资源的权限列表
   * - 资源特性（CRUD 能力）
   * - 资源元数据（图标、分组等）
   *
   * @returns 元数据对象
   */
  exportMetadata(): ReturnType<UnifiedRegistry['exportMetadata']> {
    return this.registry.exportMetadata();
  }

  // ========== 状态查询方法 ==========

  /**
   * 检查是否已初始化
   * 用于确保在正确的时机调用 init()
   *
   * @returns 是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取系统摘要信息
   * 用于监控、日志、调试
   *
   * **包含信息**：
   * - initialized: 是否已初始化
   * - resources: 注册的资源数量
   * - permissions: 注册的权限数量
   * - policies: 注册的策略数量
   * - plugins: 安装的插件数量
   *
   * **使用场景**：
   * - 健康检查端点
   * - 启动日志
   * - 监控指标
   * - 调试信息
   *
   * @returns 系统摘要信息
   */
  getSummary(): {
    initialized: boolean;
    resources: number;
    permissions: number;
    policies: number;
    plugins: number;
  } {
    const registrySummary = this.registry.getSummary();

    return {
      initialized: this.initialized,
      ...registrySummary,
      plugins: this.plugins.list().length,
    };
  }
}

/**
 * 创建 MTPC 实例
 * 工厂函数，便于创建和配置 MTPC 实例
 *
 * **推荐用法**：
 * - 每个应用创建独立的 MTPC 实例
 * - 根据环境传递不同配置
 * - 在应用启动时创建并初始化
 *
 * **示例**：
 * ```typescript
 * const mtpc = createMTPC({
 *   defaultPermissionResolver: async (tenantId, subjectId) => {
 *     // 从数据库或外部服务加载权限
 *     return await loadPermissionsFromDB(tenantId, subjectId);
 *   }
 * });
 *
 * // 注册资源、策略、插件
 * mtpc.registerResources([...]);
 * mtpc.registerPolicies([...]);
 * mtpc.use(auditPlugin);
 *
 * // 初始化
 * await mtpc.init();
 * ```
 *
 * @param options MTPC 配置选项
 * @returns MTPC 实例
 */
export function createMTPC(options?: MTPCOptions): MTPC {
  return new MTPC(options);
}

// ========== 默认实例管理 ==========

/**
 * 默认 MTPC 实例
 * 单例模式，避免重复创建实例
 * **注意**：仅用于简单场景，生产环境建议显式创建实例
 */
let defaultInstance: MTPC | null = null;

/**
 * 获取或创建默认 MTPC 实例
 * 线程安全（JS 是单线程）
 *
 * **使用建议**：
 * - 小型项目或原型
 * - 测试环境
 * - 简单脚本工具
 *
 * **注意**：
 * - 如果未提供 defaultPermissionResolver，将使用返回空权限集的默认解析器
 * - 这意味着默认情况下所有权限检查都将被拒绝
 *
 * @param options MTPC 配置选项（可选）
 * @returns 默认 MTPC 实例
 *
 * @example
 * ```typescript
 * // 简单使用（返回空权限集，所有检查将被拒绝）
 * const mtpc = getDefaultMTPC();
 *
 * // 自定义配置
 * const mtpc = getDefaultMTPC({
 *   defaultPermissionResolver: async (tenantId, subjectId) => {
 *     return new Set(['user:read', 'user:write']);
 *   }
 * });
 * ```
 */
export function getDefaultMTPC(options?: MTPCOptions): MTPC {
  if (!defaultInstance) {
    // 如果没有提供 resolver，使用返回空权限集的默认解析器
    const resolvedOptions: MTPCOptions = { ...options };
    if (!resolvedOptions.defaultPermissionResolver) {
      resolvedOptions.defaultPermissionResolver = async () => new Set();
    }
    defaultInstance = createMTPC(resolvedOptions);
  }
  return defaultInstance;
}

/**
 * 重置默认实例
 * **仅用于测试**，避免测试间的状态污染
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetDefaultMTPC(); // 清理之前的实例
 * });
 * ```
 */
export function resetDefaultMTPC(): void {
  defaultInstance = null;
}
