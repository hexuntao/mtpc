import type { SubjectContext, TenantContext } from '@mtpc/core';

/**
 * 角色状态
 * 定义角色在系统中的生命周期状态
 *
 * 可选值：
 * - `active`: 角色处于活动状态，可以正常分配和使用
 * - `inactive`: 角色被停用，暂时不可使用但保留数据
 * - `archived`: 角色已归档，仅保留历史记录
 */
export type RoleStatus = 'active' | 'inactive' | 'archived';

/**
 * 角色类型
 * 定义角色的分类和用途
 *
 * 可选值：
 * - `system`: 系统预定义角色，由系统初始化时创建，不可修改和删除
 * - `custom`: 用户自定义角色，由用户创建和管理
 * - `template`: 角色模板，用于快速创建相似角色的基础模板
 */
export type RoleType = 'system' | 'custom' | 'template';

/**
 * 角色定义
 * 定义角色的完整信息结构
 *
 * 特性：
 * - 支持角色继承，可以继承其他角色的权限
 * - 支持租户隔离，每个角色属于特定的租户
 * - 包含审计信息（创建时间、更新时间、创建者）
 * - 支持自定义元数据扩展
 *
 * @example
 * ```typescript
 * const adminRole: RoleDefinition = {
 *   id: 'role-001',
 *   tenantId: 'tenant-001',
 *   name: 'admin',
 *   displayName: 'Administrator',
 *   description: 'Full system access',
 *   type: 'system',
 *   status: 'active',
 *   permissions: ['*'],
 *   inherits: [],
 *   metadata: { category: 'system' },
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   createdBy: 'system'
 * };
 * ```
 */
export interface RoleDefinition {
  /**
   * 角色唯一标识符
   * 系统自动生成，不可修改
   */
  id: string;

  /**
   * 所属租户 ID
   * 用于实现多租户隔离
   */
  tenantId: string;

  /**
   * 角色名称
   * 唯一标识角色，用于系统内部引用
   * 规则：以字母开头，仅包含字母、数字、下划线和连字符
   */
  name: string;

  /**
   * 角色显示名称
   * 用户友好的名称，用于 UI 展示
   */
  displayName?: string;

  /**
   * 角色描述
   * 详细说明角色的用途和权限范围
   */
  description?: string;

  /**
   * 角色类型
   * 区分系统角色、自定义角色或模板角色
   */
  type: RoleType;

  /**
   * 角色状态
   * 控制角色是否可用
   */
  status: RoleStatus;

  /**
   * 权限列表
   * 角色拥有的所有权限字符串
   * 支持通配符模式匹配
   */
  permissions: string[];

  /**
   * 继承的角色 ID 列表
   * 当前角色会继承所有父角色的权限
   * 支持多重继承
   */
  inherits?: string[];

  /**
   * 自定义元数据
   * 用于存储额外的扩展信息
   */
  metadata?: Record<string, unknown>;

  /**
   * 创建时间
   * 角色首次创建的时间戳
   */
  createdAt: Date;

  /**
   * 更新时间
   * 角色最后一次修改的时间戳
   */
  updatedAt: Date;

  /**
   * 创建者 ID
   * 创建该角色的用户或系统标识
   */
  createdBy?: string;
}

/**
 * 角色创建输入
 * 创建新角色时所需的输入参数
 *
 * 特性：
 * - 必填字段：name
 * - 可选字段：displayName、description、type、permissions、inherits、metadata
 * - 自动生成的字段：id、tenantId、createdAt、updatedAt、status
 *
 * 验证规则：
 * - name: 2-50 字符，以字母开头，仅包含字母、数字、下划线和连字符
 * - displayName: 最多 100 字符
 * - description: 最多 500 字符
 *
 * @example
 * ```typescript
 * const input: RoleCreateInput = {
 *   name: 'content_editor',
 *   displayName: 'Content Editor',
 *   description: 'Can edit and publish content',
 *   type: 'custom',
 *   permissions: ['content:read', 'content:write', 'content:publish'],
 *   inherits: ['content_viewer'],
 *   metadata: { department: 'editorial' }
 * };
 * ```
 */
export interface RoleCreateInput {
  /**
   * 角色名称
   * 2-50 字符，以字母开头
   */
  name: string;

  /**
   * 角色显示名称
   * 最多 100 字符
   */
  displayName?: string;

  /**
   * 角色描述
   * 最多 500 字符
   */
  description?: string;

  /**
   * 角色类型
   * 默认为 'custom'
   */
  type?: RoleType;

  /**
   * 权限列表
   * 默认为空数组
   */
  permissions?: string[];

  /**
   * 继承的角色 ID 列表
   */
  inherits?: string[];

  /**
   * 自定义元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 角色更新输入
 * 更新现有角色时的输入参数
 *
 * 特性：
 * - 所有字段都是可选的
 * - name 和 type 不可修改
 * - 更新会自动更新 updatedAt 时间戳
 *
 * @example
 * ```typescript
 * const update: RoleUpdateInput = {
 *   displayName: 'Senior Content Editor',
 *   status: 'active',
 *   permissions: ['content:read', 'content:write', 'content:publish', 'content:delete']
 * };
 * ```
 */
export interface RoleUpdateInput {
  /**
   * 角色显示名称
   */
  displayName?: string;

  /**
   * 角色描述
   */
  description?: string;

  /**
   * 角色状态
   */
  status?: RoleStatus;

  /**
   * 权限列表
   * 完全替换现有权限
   */
  permissions?: string[];

  /**
   * 继承的角色 ID 列表
   * 完全替换现有继承关系
   */
  inherits?: string[];

  /**
   * 自定义元数据
   * 会与现有元数据合并
   */
  metadata?: Record<string, unknown>;
}

/**
 * 角色绑定主体类型
 * 定义可以绑定角色的主体类型
 *
 * 可选值：
 * - `user`: 用户，系统中的单个用户账号
 * - `group`: 用户组，多个用户的集合
 * - `service`: 服务，系统服务或应用程序账号
 */
export type BindingSubjectType = 'user' | 'group' | 'service';

/**
 * 角色绑定
 * 将角色分配给特定主体的绑定关系
 *
 * 特性：
 * - 支持过期时间，可实现临时权限授予
 * - 支持租户隔离
 * - 包含审计信息
 * - 支持自定义元数据
 *
 * @example
 * ```typescript
 * const binding: RoleBinding = {
 *   id: 'bind-001',
 *   tenantId: 'tenant-001',
 *   roleId: 'role-001',
 *   subjectType: 'user',
 *   subjectId: 'user-123',
 *   expiresAt: new Date('2025-12-31'),
 *   metadata: { grantedBy: 'admin' },
 *   createdAt: new Date(),
 *   createdBy: 'admin'
 * };
 * ```
 */
export interface RoleBinding {
  /**
   * 绑定唯一标识符
   * 系统自动生成
   */
  id: string;

  /**
   * 所属租户 ID
   */
  tenantId: string;

  /**
   * 绑定的角色 ID
   */
  roleId: string;

  /**
   * 主体类型
   * 指定绑定的主体类型（用户、组或服务）
   */
  subjectType: BindingSubjectType;

  /**
   * 主体 ID
   * 主体的唯一标识符
   */
  subjectId: string;

  /**
   * 过期时间
   * 绑定失效的时间点
   * 未设置表示永久有效
   */
  expiresAt?: Date;

  /**
   * 自定义元数据
   * 存储额外的绑定信息
   */
  metadata?: Record<string, unknown>;

  /**
   * 创建时间
   */
  createdAt: Date;

  /**
   * 创建者 ID
   * 创建该绑定的用户或系统标识
   */
  createdBy?: string;
}

/**
 * 角色绑定创建输入
 * 创建角色绑定时的输入参数
 *
 * @example
 * ```typescript
 * const input: RoleBindingCreateInput = {
 *   roleId: 'role-001',
 *   subjectType: 'user',
 *   subjectId: 'user-123',
 *   expiresAt: new Date('2025-12-31'),
 *   metadata: { reason: 'project_assignment' }
 * };
 * ```
 */
export interface RoleBindingCreateInput {
  /**
   * 要绑定的角色 ID
   */
  roleId: string;

  /**
   * 主体类型
   */
  subjectType: BindingSubjectType;

  /**
   * 主体 ID
   */
  subjectId: string;

  /**
   * 过期时间
   * 必须是未来的时间
   */
  expiresAt?: Date;

  /**
   * 自定义元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * 有效权限结果
 * 计算主体实际拥有的所有权限
 *
 * 特性：
 * - 包含所有绑定角色的权限
 * - 自动合并继承权限
 * - 包含权限来源角色列表
 * - 支持缓存过期机制
 *
 * @example
 * ```typescript
 * const permissions: EffectivePermissions = {
 *   tenantId: 'tenant-001',
 *   subjectId: 'user-123',
 *   subjectType: 'user',
 *   roles: ['role-001', 'role-002'],
 *   permissions: new Set(['content:read', 'content:write', 'user:read']),
 *   computedAt: new Date(),
 *   expiresAt: new Date(Date.now() + 60000)
 * };
 * ```
 */
export interface EffectivePermissions {
  /**
   * 所属租户 ID
   */
  tenantId: string;

  /**
   * 主体 ID
   */
  subjectId: string;

  /**
   * 主体类型
   */
  subjectType: BindingSubjectType;

  /**
   * 权限来源角色 ID 列表
   * 包含所有绑定且有效的角色
   */
  roles: string[];

  /**
   * 有效权限集合
   * 包含所有直接和间接权限
   */
  permissions: Set<string>;

  /**
   * 计算时间
   * 权限计算的时间戳
   */
  computedAt: Date;

  /**
   * 缓存过期时间
   * 用于权限缓存失效
   */
  expiresAt?: Date;
}

/**
 * RBAC 权限检查上下文
 * 执行权限检查所需的上下文信息
 *
 * @example
 * ```typescript
 * const context: RBACCheckContext = {
 *   tenant: { id: 'tenant-001', ... },
 *   subject: { id: 'user-123', type: 'user', ... },
 *   permission: 'content:delete',
 *   resourceId: 'article-456'
 * };
 * ```
 */
export interface RBACCheckContext {
  /**
   * 租户上下文
   * 包含租户相关信息
   */
  tenant: TenantContext;

  /**
   * 主体上下文
   * 包含请求操作的主体信息
   */
  subject: SubjectContext;

  /**
   * 要检查的权限
   * 权限字符串，支持通配符匹配
   */
  permission: string;

  /**
   * 资源 ID
   * 可选，用于更细粒度的权限控制
   */
  resourceId?: string;
}

/**
 * RBAC 权限检查结果
 * 权限检查的返回结果
 *
 * @example
 * ```typescript
 * const result: RBACCheckResult = {
 *   allowed: true,
 *   matchedRoles: ['admin', 'editor'],
 *   reason: 'Granted by roles: admin, editor'
 * };
 * ```
 */
export interface RBACCheckResult {
  /**
   * 是否允许访问
   * true 表示权限检查通过
   */
  allowed: boolean;

  /**
   * 匹配的角色列表
   * 授予该权限的所有角色 ID
   */
  matchedRoles: string[];

  /**
   * 原因说明
   * 人类可读的检查结果说明
   */
  reason?: string;
}

/**
 * RBAC 存储接口
 * 定义 RBAC 数据存储的抽象接口
 *
 * 特性：
 * - 支持角色管理（CRUD）
 * - 支持角色绑定管理
 * - 支持有效权限计算
 * - 支持权限缓存失效
 * - 所有操作都是异步的
 *
 * 实现要求：
 * - 线程安全（如果支持并发）
 * - 数据持久化（根据实现不同）
 * - 租户隔离
 *
 * @example
 * ```typescript
 * class DatabaseRBACStore implements RBACStore {
 *   async createRole(tenantId: string, input: RoleCreateInput) {
 *     return await db.roles.create({ tenantId, ...input });
 *   }
 *   // ... 实现其他方法
 * }
 * ```
 */
export interface RBACStore {
  /**
   * 创建角色
   * @param tenantId 租户 ID
   * @param input 角色创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色定义
   */
  createRole(tenantId: string, input: RoleCreateInput, createdBy?: string): Promise<RoleDefinition>;

  /**
   * 更新角色
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param input 角色更新输入
   * @returns 更新后的角色定义，不存在则返回 null
   */
  updateRole(
    tenantId: string,
    roleId: string,
    input: RoleUpdateInput
  ): Promise<RoleDefinition | null>;

  /**
   * 删除角色
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 是否删除成功
   */
  deleteRole(tenantId: string, roleId: string): Promise<boolean>;

  /**
   * 获取角色
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 角色定义，不存在则返回 null
   */
  getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null>;

  /**
   * 根据名称获取角色
   * @param tenantId 租户 ID
   * @param name 角色名称
   * @returns 角色定义，不存在则返回 null
   */
  getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null>;

  /**
   * 列出角色
   * @param tenantId 租户 ID
   * @param options 筛选选项
   * @returns 角色定义列表
   */
  listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]>;

  /**
   * 创建角色绑定
   * @param tenantId 租户 ID
   * @param input 绑定创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色绑定
   */
  createBinding(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding>;

  /**
   * 删除角色绑定
   * @param tenantId 租户 ID
   * @param bindingId 绑定 ID
   * @returns 是否删除成功
   */
  deleteBinding(tenantId: string, bindingId: string): Promise<boolean>;

  /**
   * 获取角色绑定
   * @param tenantId 租户 ID
   * @param bindingId 绑定 ID
   * @returns 角色绑定，不存在则返回 null
   */
  getBinding(tenantId: string, bindingId: string): Promise<RoleBinding | null>;

  /**
   * 列出角色绑定
   * @param tenantId 租户 ID
   * @param options 筛选选项
   * @returns 角色绑定列表
   */
  listBindings(
    tenantId: string,
    options?: { roleId?: string; subjectId?: string; subjectType?: BindingSubjectType }
  ): Promise<RoleBinding[]>;

  /**
   * 获取主体的角色绑定
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 角色绑定列表
   */
  getSubjectBindings(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]>;

  /**
   * 获取有效权限
   * 计算主体实际拥有的所有权限
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 有效权限结果
   */
  getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions>;

  /**
   * 使权限缓存失效
   * @param tenantId 租户 ID
   * @param subjectId 主体 ID，未指定则使整个租户的缓存失效
   */
  invalidatePermissions(tenantId: string, subjectId?: string): Promise<void>;
}

/**
 * RBAC 配置选项
 * 创建 RBAC 实例时的配置参数
 *
 * @example
 * ```typescript
 * const options: RBACOptions = {
 *   store: new DatabaseRBACStore(),
 *   cacheEnabled: true,
 *   cacheTTL: 300000,
 *   systemRoles: [customSuperAdminRole],
 *   permissionResolver: customPermissionResolver
 * };
 * ```
 */
export interface RBACOptions {
  /**
   * 自定义存储后端
   * 未指定则使用内存存储
   */
  store?: RBACStore;

  /**
   * 是否启用缓存
   * 默认为 true
   * @deprecated 使用 cacheTTL 代替
   */
  cacheEnabled?: boolean;

  /**
   * 缓存生存时间（毫秒）
   * 默认 60000（1 分钟）
   */
  cacheTTL?: number;

  /**
   * 自定义系统角色
   * 未指定则使用默认系统角色
   */
  systemRoles?: RoleDefinition[];

  /**
   * 自定义权限解析器
   * 用于从外部获取额外权限
   */
  permissionResolver?: (tenantId: string, subjectId: string) => Promise<Set<string>>;
}
