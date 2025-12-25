import type { PluginContext, PluginDefinition } from '@mtpc/core';
import { BindingManager } from './binding/manager.js';
import { RBACEvaluator } from './policy/evaluator.js';
import { systemRoles } from './role/builder.js';
import { RoleManager } from './role/manager.js';
import { InMemoryRBACStore } from './store/memory-store.js';
import type { RBACOptions, RBACStore } from './types.js';

/**
 * RBAC 插件状态
 * 包含插件的所有核心组件实例
 *
 * @example
 * ```typescript
 * // 在 MTPC 插件系统中访问 RBAC 功能
 * const plugin = mtpc.getPlugin('@mtpc/rbac');
 * const { roles, bindings, evaluator } = plugin.state;
 *
 * // 使用角色管理器
 * await roles.createRole('tenant-001', { name: 'editor' });
 *
 * // 使用绑定管理器
 * await bindings.assignRole('tenant-001', 'editor', 'user', 'user-123');
 *
 * // 使用权限评估器
 * const result = await evaluator.check({ tenant, subject, permission });
 * ```
 */
export interface RBACPluginState {
  /**
   * 数据存储后端
   * 负责角色和绑定的持久化
   */
  store: RBACStore;

  /**
   * 角色管理器
   * 提供角色的 CRUD 操作
   */
  roles: RoleManager;

  /**
   * 绑定管理器
   * 处理角色与主体的绑定关系
   */
  bindings: BindingManager;

  /**
   * 权限评估器
   * 负责权限检查和有效权限计算
   */
  evaluator: RBACEvaluator;
}

/**
 * 创建 RBAC 插件
 * 创建一个可集成到 MTPC 的 RBAC 插件
 *
 * 特性：
 * - 自动初始化所有 RBAC 组件
 * - 注册默认系统角色（超级管理员、租户管理员、访客）
 * - 提供全局钩子集成点
 * - 自动清理缓存
 *
 * @param options 插件配置选项
 * @returns MTPC 插件定义
 *
 * @example
 * ```typescript
 * import { createMTPC } from '@mtpc/core';
 * import { createRBACPlugin } from '@mtpc/rbac';
 *
 * // 创建 RBAC 插件
 * const rbacPlugin = createRBACPlugin();
 *
 * // 创建 MTPC 实例
 * const mtpc = createMTPC({
 *   // 必须提供 defaultPermissionResolver，或后续通过 setPermissionResolver 设置
 *   defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
 * });
 *
 * // 注册插件（可选，用于访问插件状态）
 * mtpc.use(rbacPlugin);
 *
 * // 初始化
 * await mtpc.init();
 *
 * // 访问 RBAC 功能
 * const rbac = mtpc.getPlugin('@mtpc/rbac');
 * if (rbac?.state) {
 *   await rbac.state.roles.createRole('tenant-001', {
 *     name: 'editor',
 *     permissions: ['content:read', 'content:write']
 *   });
 * }
 * ```
 */
export function createRBACPlugin(
  options: RBACOptions = {}
): PluginDefinition & { state: RBACPluginState } {
  // 初始化存储后端
  const store = options.store ?? new InMemoryRBACStore();

  // 初始化管理器
  const roles = new RoleManager(store);
  const bindings = new BindingManager(store);
  const evaluator = new RBACEvaluator(store, {
    cacheTTL: options.cacheTTL,
  });

  // 注册系统角色
  const defaultSystemRoles = options.systemRoles ?? [
    systemRoles.superAdmin().buildDefinition('super_admin'),
    systemRoles.tenantAdmin().buildDefinition('tenant_admin'),
    systemRoles.viewer().buildDefinition('viewer'),
  ];

  // 注册所有默认系统角色
  for (const role of defaultSystemRoles) {
    roles.registerSystemRole(role);
  }

  // 创建插件状态
  const state: RBACPluginState = {
    store,
    roles,
    bindings,
    evaluator,
  };

  // 返回插件定义
  return {
    name: '@mtpc/rbac',
    version: '0.1.0',
    description: 'Role-Based Access Control extension for MTPC',

    // 使用类型断言来满足 PluginDefinition.state 类型
    state: state as unknown as NonNullable<typeof state>,

    /**
     * 插件安装钩子
     * 在插件注册到 MTPC 时调用
     *
     * 功能：
     * - 注册全局钩子用于权限检查
     * - 集成到 MTPC 的请求处理流程
     *
     * @param context 插件上下文
     */
    install(context: PluginContext): void {
      // 注册全局钩子用于权限检查
      context.registerGlobalHooks({
        beforeAny: [
          async () => {
            // 此钩子可用于注入基于 RBAC 的权限检查
            // 目前直接返回 proceed: true
            return { proceed: true };
          },
        ],
      });
    },

    /**
     * 插件初始化钩子
     * 在 MTPC 完成初始化后调用
     */
    onInit(): void {
      console.log('RBAC plugin initialized');
    },

    /**
     * 插件销毁钩子
     * 在 MTPC 关闭时调用
     * 清理资源，清除缓存
     */
    onDestroy(): void {
      evaluator.clearCache();
    },
  };
}
