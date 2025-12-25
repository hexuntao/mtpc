import type { MTPC, SubjectContext, TenantContext } from '@mtpc/core';
import { BindingManager } from './binding/manager.js';
import { RBACEvaluator } from './policy/evaluator.js';
import { systemRoles } from './role/builder.js';
import { RoleManager } from './role/manager.js';
import { InMemoryRBACStore } from './store/memory-store.js';
import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACCheckContext,
  RBACCheckResult,
  RBACOptions,
  RBACStore,
  RoleBinding,
  RoleCreateInput,
  RoleDefinition,
  RoleUpdateInput,
} from './types.js';

/**
 * RBAC（基于角色的访问控制）
 * 为 MTPC 提供完整的角色和权限管理功能
 *
 * 特性：
 * - 角色管理：创建、更新、删除和查询角色
 * - 角色绑定：将角色分配给用户、组或服务
 * - 权限检查：基于角色和绑定进行权限验证
 * - 角色继承：支持角色间的权限继承关系
 * - 权限缓存：内置缓存机制提高性能
 * - 多租户支持：完全的租户隔离
 * - 系统角色：预定义的超级管理员、租户管理员和访客角色
 *
 * 默认系统角色：
 * - super_admin: 超级管理员，拥有所有权限（通配符 *）
 * - tenant_admin: 租户管理员，完全的租户访问权限
 * - viewer: 访客角色，只读权限
 *
 * @example
 * ```typescript
 * // 使用默认配置创建 RBAC 实例
 * const rbac = new RBAC();
 *
 * // 自定义配置
 * const rbac = new RBAC({
 *   store: new DatabaseRBACStore(),
 *   cacheTTL: 300000, // 5 分钟缓存
 *   systemRoles: [customSuperAdminRole]
 * });
 *
 * // 创建角色
 * await rbac.createRole('tenant-001', {
 *   name: 'editor',
 *   displayName: 'Content Editor',
 *   permissions: ['content:read', 'content:write']
 * });
 *
 * // 分配角色
 * await rbac.assignRole('tenant-001', 'editor', 'user', 'user-123');
 *
 * // 检查权限
 * const result = await rbac.check(tenantContext, userContext, 'content:write');
 * if (result.allowed) {
 *   // 允许操作
 * }
 * ```
 */
export class RBAC {
  /**
   * 数据存储后端
   * 负责角色和绑定的持久化
   */
  private store: RBACStore;

  /**
   * 角色管理器
   * 处理角色的 CRUD 操作
   */
  private roleManager: RoleManager;

  /**
   * 绑定管理器
   * 处理角色与主体的绑定关系
   */
  private bindingManager: BindingManager;

  /**
   * 权限评估器
   * 负责权限检查和有效权限计算
   */
  private evaluator: RBACEvaluator;

  /**
   * 创建 RBAC 实例
   * @param options 配置选项
   *
   * @example
   * ```typescript
   * // 使用默认配置
   * const rbac = new RBAC();
   *
   * // 使用内存存储
   * const rbac = new RBAC({
   *   cacheTTL: 60000
   * });
   *
   * // 使用自定义存储
   * const rbac = new RBAC({
   *   store: new DatabaseRBACStore(),
   *   cacheTTL: 300000,
   *   systemRoles: [customRole]
   * });
   * ```
   */
  constructor(options: RBACOptions = {}) {
    // 初始化存储后端
    this.store = options.store ?? new InMemoryRBACStore();

    // 初始化管理器
    this.roleManager = new RoleManager(this.store);
    this.bindingManager = new BindingManager(this.store);
    this.evaluator = new RBACEvaluator(this.store, {
      cacheTTL: options.cacheTTL,
    });

    // 注册默认系统角色
    const defaultSystemRoles = options.systemRoles ?? [
      systemRoles.superAdmin().buildDefinition('super_admin'),
      systemRoles.tenantAdmin().buildDefinition('tenant_admin'),
      systemRoles.viewer().buildDefinition('viewer'),
    ];

    // 注册所有系统角色
    for (const role of defaultSystemRoles) {
      this.roleManager.registerSystemRole(role);
    }
  }

  // ============== 角色管理 ==============

  /**
   * 创建角色
   * 在指定租户下创建新的自定义角色
   *
   * @param tenantId 租户 ID
   * @param input 角色创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色定义
   * @throws Error 角色名称已存在或输入无效
   *
   * @example
   * ```typescript
   * const role = await rbac.createRole('tenant-001', {
   *   name: 'editor',
   *   displayName: 'Content Editor',
   *   description: 'Can edit and publish content',
   *   permissions: ['content:read', 'content:write'],
   *   inherits: ['viewer']
   * }, 'admin');
   * ```
   */
  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    createdBy?: string
  ): Promise<RoleDefinition> {
    return this.roleManager.createRole(tenantId, input, createdBy);
  }

  /**
   * 更新角色
   * 更新现有角色的属性
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param input 角色更新输入
   * @returns 更新后的角色定义，不存在则返回 null
   * @throws Error 尝试修改系统角色
   *
   * @example
   * ```typescript
   * const updated = await rbac.updateRole('tenant-001', 'role-001', {
   *   displayName: 'Senior Editor',
   *   permissions: ['content:read', 'content:write', 'content:publish']
   * });
   * ```
   */
  async updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null> {
    const result = await this.roleManager.updateRole(tenantId, roleId, input);
    if (result) {
      // 角色更新后使权限缓存失效
      this.evaluator.invalidate(tenantId);
    }
    return result;
  }

  /**
   * 删除角色
   * 永久删除指定角色
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 是否删除成功
   * @throws Error 尝试删除系统角色
   *
   * @example
   * ```typescript
   * const deleted = await rbac.deleteRole('tenant-001', 'role-001');
   * if (deleted) {
   *   console.log('角色已删除');
   * }
   * ```
   */
  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const result = await this.roleManager.deleteRole(tenantId, roleId);
    if (result) {
      // 角色删除后使权限缓存失效
      this.evaluator.invalidate(tenantId);
    }
    return result;
  }

  /**
   * 获取角色
   * 根据 ID 获取角色定义
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 角色定义，不存在则返回 null
   *
   * @example
   * ```typescript
   * const role = await rbac.getRole('tenant-001', 'role-001');
   * if (role) {
   *   console.log(role.displayName);
   * }
   * ```
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    return this.roleManager.getRole(tenantId, roleId);
  }

  /**
   * 列出角色
   * 获取租户下的所有角色
   *
   * @param tenantId 租户 ID
   * @returns 角色定义列表
   *
   * @example
   * ```typescript
   * const roles = await rbac.listRoles('tenant-001');
   * console.log(`共有 ${roles.length} 个角色`);
   * ```
   */
  async listRoles(tenantId: string): Promise<RoleDefinition[]> {
    return this.roleManager.listRoles(tenantId);
  }

  // ============== 角色绑定 ==============

  /**
   * 分配角色
   * 将角色分配给指定的主体（用户、组或服务）
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @param options 可选配置
   * @returns 创建的角色绑定
   *
   * @example
   * ```typescript
   * // 永久分配
   * const binding = await rbac.assignRole(
   *   'tenant-001',
   *   'editor',
   *   'user',
   *   'user-123'
   * );
   *
   * // 临时分配（30 天后过期）
   * const binding = await rbac.assignRole(
   *   'tenant-001',
   *   'editor',
   *   'user',
   *   'user-123',
   *   { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
   * );
   * ```
   */
  async assignRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string,
    options?: { expiresAt?: Date; createdBy?: string }
  ): Promise<RoleBinding> {
    const binding = await this.bindingManager.assignRole(
      tenantId,
      {
        roleId,
        subjectType,
        subjectId,
        expiresAt: options?.expiresAt,
      },
      options?.createdBy
    );
    // 绑定更新后使权限缓存失效
    this.evaluator.invalidate(tenantId, subjectId);
    return binding;
  }

  /**
   * 撤销角色
   * 从主体移除指定的角色
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 是否撤销成功
   *
   * @example
   * ```typescript
   * const revoked = await rbac.revokeRole(
   *   'tenant-001',
   *   'editor',
   *   'user',
   *   'user-123'
   * );
   * ```
   */
  async revokeRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<boolean> {
    const result = await this.bindingManager.revokeRole(tenantId, roleId, subjectType, subjectId);
    if (result) {
      // 绑定更新后使权限缓存失效
      this.evaluator.invalidate(tenantId, subjectId);
    }
    return result;
  }

  /**
   * 获取主体的角色
   * 获取指定主体的所有有效角色绑定
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 角色绑定列表
   *
   * @example
   * ```typescript
   * const bindings = await rbac.getSubjectRoles('tenant-001', 'user', 'user-123');
   * console.log(`用户有 ${bindings.length} 个角色`);
   * for (const binding of bindings) {
   *   console.log(`- ${binding.roleId}`);
   * }
   * ```
   */
  async getSubjectRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    return this.bindingManager.getSubjectRoles(tenantId, subjectType, subjectId);
  }

  /**
   * 检查主体是否有角色
   * 判断主体是否拥有指定的角色
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 是否拥有该角色
   *
   * @example
   * ```typescript
   * const hasEditor = await rbac.hasRole('tenant-001', 'editor', 'user', 'user-123');
   * if (hasEditor) {
   *   console.log('用户是编辑');
   * }
   * ```
   */
  async hasRole(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<boolean> {
    return this.bindingManager.hasRole(tenantId, roleId, subjectType, subjectId);
  }

  // ============== 权限检查 ==============

  /**
   * 检查权限
   * 检查主体是否拥有指定的权限
   *
   * @param context 权限检查上下文
   * @returns 权限检查结果
   *
   * @example
   * ```typescript
   * const result = await rbac.checkPermission({
   *   tenant: tenantContext,
   *   subject: userContext,
   *   permission: 'content:delete',
   *   resourceId: 'article-123'
   * });
   *
   * if (result.allowed) {
   *   console.log(`权限授予来源: ${result.matchedRoles.join(', ')}`);
   * } else {
   *   console.log(`拒绝原因: ${result.reason}`);
   * }
   * ```
   */
  async checkPermission(context: RBACCheckContext): Promise<RBACCheckResult> {
    return this.evaluator.check(context);
  }

  /**
   * 使用 MTPC 上下文检查权限
   * 便捷方法，直接使用 MTPC 的上下文对象进行权限检查
   *
   * @param tenant 租户上下文
   * @param subject 主体上下文
   * @param permission 要检查的权限
   * @returns 权限检查结果
   *
   * @example
   * ```typescript
   * const result = await rbac.check(tenantContext, userContext, 'content:write');
   * if (result.allowed) {
   *   // 允许写入操作
   * }
   * ```
   */
  async check(
    tenant: TenantContext,
    subject: SubjectContext,
    permission: string
  ): Promise<RBACCheckResult> {
    return this.checkPermission({
      tenant,
      subject,
      permission,
    });
  }

  /**
   * 获取有效权限
   * 获取主体的所有有效权限（包括继承权限）
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 有效权限结果
   *
   * @example
   * ```typescript
   * const effective = await rbac.getEffectivePermissions('tenant-001', 'user', 'user-123');
   * console.log(`权限来源角色: ${effective.roles.join(', ')}`);
   * console.log(`权限数量: ${effective.permissions.size}`);
   * ```
   */
  async getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions> {
    return this.evaluator.getEffectivePermissions(tenantId, subjectType, subjectId);
  }

  /**
   * 获取权限列表
   * 以数组形式返回主体的所有权限
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 权限字符串数组
   *
   * @example
   * ```typescript
   * const permissions = await rbac.getPermissions('tenant-001', 'user', 'user-123');
   * console.log('用户权限:', permissions);
   * ```
   */
  async getPermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<string[]> {
    return this.evaluator.getPermissions(tenantId, subjectType, subjectId);
  }

  /**
   * 创建权限解析器
   *
   * 将 (tenantId, subjectId) 映射到 Set<permissionCode>。
   *
   * 此解析器旨在通过以下方式集成到 MTPC 中：
   * mtpc.setPermissionResolver(rbac.createPermissionResolver());
   *
   * @returns 权限解析函数
   *
   * @example
   * ```typescript
   * const resolver = rbac.createPermissionResolver();
   * const permissions = await resolver('tenant-001', 'user-123');
   * console.log(permissions); // Set<string>
   * ```
   */
  createPermissionResolver(): (tenantId: string, subjectId: string) => Promise<Set<string>> {
    return async (tenantId: string, subjectId: string) => {
      const effective = await this.getEffectivePermissions(tenantId, 'user', subjectId);
      return effective.permissions;
    };
  }

  // ============== 缓存管理 ==============

  /**
   * 使权限缓存失效
   * 清除指定租户或主体的权限缓存
   *
   * @param tenantId 租户 ID
   * @param subjectId 主体 ID，未指定则清除整个租户的缓存
   *
   * @example
   * ```typescript
   * // 清除特定用户的缓存
   * rbac.invalidateCache('tenant-001', 'user-123');
   *
   * // 清除整个租户的缓存
   * rbac.invalidateCache('tenant-001');
   * ```
   */
  invalidateCache(tenantId: string, subjectId?: string): void {
    this.evaluator.invalidate(tenantId, subjectId);
  }

  /**
   * 清空所有缓存
   * 清除所有租户和主体的权限缓存
   *
   * @example
   * ```typescript
   * rbac.clearCache();
   * console.log('所有缓存已清除');
   * ```
   */
  clearCache(): void {
    this.evaluator.clearCache();
  }

  // ============== 访问器 ==============

  /**
   * 获取角色管理器
   * 提供对底层角色管理器的直接访问
   *
   * @returns 角色管理器实例
   */
  get roles(): RoleManager {
    return this.roleManager;
  }

  /**
   * 获取绑定管理器
   * 提供对底层绑定管理器的直接访问
   *
   * @returns 绑定管理器实例
   */
  get bindings(): BindingManager {
    return this.bindingManager;
  }

  /**
   * 获取存储后端
   * 提供对底层存储的访问
   *
   * @returns RBAC 存储实例
   */
  getStore(): RBACStore {
    return this.store;
  }
}

/**
 * 创建 RBAC 实例
 * 便捷的工厂函数
 *
 * @param options 配置选项
 * @returns RBAC 实例
 *
 * @example
 * ```typescript
 * const rbac = createRBAC({
 *   cacheTTL: 300000
 * });
 * ```
 */
export function createRBAC(options?: RBACOptions): RBAC {
  return new RBAC(options);
}

/**
 * 将 RBAC 与 MTPC 集成
 * 为已存在的 MTPC 实例添加 RBAC 支持
 *
 * **注意**：推荐使用 createRBACPlugin 方式集成，此函数用于兼容旧的独立 RBAC 实例
 *
 * @param mtpc MTPC 实例
 * @param rbac RBAC 实例
 *
 * @example
 * ```typescript
 * import { createMTPC, createRBAC } from '@mtpc/rbac';
 *
 * // 方式 1：使用独立 RBAC 实例（旧方式，仍支持）
 * const rbac = createRBAC();
 * const mtpc = createMTPC();
 * integrateWithMTPC(mtpc, rbac);
 * await mtpc.init();
 *
 * // 方式 2：推荐使用 createRBACPlugin
 * const rbacPlugin = createRBACPlugin();
 * const mtpc = createMTPC({
 *   defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
 * });
 * mtpc.use(rbacPlugin);
 * await mtpc.init();
 * ```
 */
export function integrateWithMTPC(mtpc: MTPC, rbac: RBAC): void {
  mtpc.setPermissionResolver(rbac.createPermissionResolver());
}
