import type { RoleCreateInput, RoleDefinition, RoleType } from '../types.js';

/**
 * 角色构建器
 * 提供流式 API 用于构建角色定义
 *
 * 特性：
 * - 链式调用，语法简洁
 * - 预定义常用权限模式
 * - 支持角色继承
 * - 可生成输入或完整定义
 *
 * @example
 * ```typescript
 * const role = role('editor')
 *   .displayName('Content Editor')
 *   .description('Can create and edit content')
 *   .permissions('content:read', 'content:write')
 *   .inherit('viewer')
 *   .build();
 * ```
 */
export class RoleBuilder {
  /**
   * 角色创建输入
   * 存储构建过程中的角色数据
   */
  private input: RoleCreateInput;

  /**
   * 创建角色构建器
   * @param name 角色名称
   */
  constructor(name: string) {
    this.input = {
      name,
      type: 'custom',
      permissions: [],
    };
  }

  /**
   * 设置显示名称
   * @param displayName 用户友好的角色名称
   * @returns this
   *
   * @example
   * ```typescript
   * builder.displayName('Content Editor');
   * ```
   */
  displayName(displayName: string): this {
    this.input.displayName = displayName;
    return this;
  }

  /**
   * 设置描述
   * @param description 角色的详细说明
   * @returns this
   *
   * @example
   * ```typescript
   * builder.description('Can create, edit and publish content');
   * ```
   */
  description(description: string): this {
    this.input.description = description;
    return this;
  }

  /**
   * 设置角色类型
   * @param type 角色类型（system、custom、template）
   * @returns this
   */
  type(type: RoleType): this {
    this.input.type = type;
    return this;
  }

  /**
   * 设置为系统角色
   * @returns this
   */
  system(): this {
    this.input.type = 'system';
    return this;
  }

  /**
   * 设置为模板角色
   * @returns this
   */
  template(): this {
    this.input.type = 'template';
    return this;
  }

  /**
   * 添加单个权限
   * @param permission 权限字符串
   * @returns this
   *
   * @example
   * ```typescript
   * builder.permission('content:read');
   * ```
   */
  permission(permission: string): this {
    this.input.permissions = [...(this.input.permissions ?? []), permission];
    return this;
  }

  /**
   * 添加多个权限
   * @param permissions 权限字符串列表
   * @returns this
   *
   * @example
   * ```typescript
   * builder.permissions('content:read', 'content:write', 'content:delete');
   * ```
   */
  permissions(...permissions: string[]): this {
    this.input.permissions = [...(this.input.permissions ?? []), ...permissions];
    return this;
  }

  /**
   * 添加资源的操作权限
   * 自动生成格式为 `resource:action` 的权限
   *
   * @param resource 资源名称
   * @param actions 操作列表
   * @returns this
   *
   * @example
   * ```typescript
   * builder.resourcePermissions('content', 'create', 'read', 'update', 'delete');
   * // 生成: content:create, content:read, content:update, content:delete
   * ```
   */
  resourcePermissions(resource: string, ...actions: string[]): this {
    const perms = actions.map(action => `${resource}:${action}`);
    return this.permissions(...perms);
  }

  /**
   * 添加资源的完整 CRUD 权限
   * 包含 create、read、update、delete、list 操作
   *
   * @param resource 资源名称
   * @returns this
   *
   * @example
   * ```typescript
   * builder.fullAccess('articles');
   * // 生成: articles:create, articles:read, articles:update, articles:delete, articles:list
   * ```
   */
  fullAccess(resource: string): this {
    return this.resourcePermissions(resource, 'create', 'read', 'update', 'delete', 'list');
  }

  /**
   * 添加资源的只读权限
   * 包含 read 和 list 操作
   *
   * @param resource 资源名称
   * @returns this
   *
   * @example
   * ```typescript
   * builder.readOnly('articles');
   * // 生成: articles:read, articles:list
   * ```
   */
  readOnly(resource: string): this {
    return this.resourcePermissions(resource, 'read', 'list');
  }

  /**
   * 继承单个角色
   * @param roleId 要继承的角色 ID
   * @returns this
   *
   * @example
   * ```typescript
   * builder.inherit('viewer');
   * ```
   */
  inherit(roleId: string): this {
    this.input.inherits = [...(this.input.inherits ?? []), roleId];
    return this;
  }

  /**
   * 继承多个角色
   * @param roleIds 要继承的角色 ID 列表
   * @returns this
   *
   * @example
   * ```typescript
   * builder.inherits('viewer', 'contributor');
   * ```
   */
  inherits(...roleIds: string[]): this {
    this.input.inherits = [...(this.input.inherits ?? []), ...roleIds];
    return this;
  }

  /**
   * 设置元数据
   * 多次调用会合并元数据
   *
   * @param metadata 元数据对象
   * @returns this
   *
   * @example
   * ```typescript
   * builder.metadata({ category: 'content' });
   * builder.metadata({ level: 'advanced' });
   * // 最终: { category: 'content', level: 'advanced' }
   * ```
   */
  metadata(metadata: Record<string, unknown>): this {
    this.input.metadata = { ...this.input.metadata, ...metadata };
    return this;
  }

  /**
   * 构建角色输入
   * 返回角色创建输入对象
   *
   * @returns 角色创建输入
   *
   * @example
   * ```typescript
   * const input = role('editor').displayName('Editor').build();
   * await rbac.createRole('tenant-001', input);
   * ```
   */
  build(): RoleCreateInput {
    return { ...this.input };
  }

  /**
   * 构建完整角色定义
   * 生成包含所有字段的角色定义，用于系统角色
   *
   * @param id 角色 ID
   * @param tenantId 租户 ID，默认为 'system'
   * @returns 完整角色定义
   *
   * @example
   * ```typescript
   * const systemRole = role('admin')
   *   .displayName('Administrator')
   *   .permission('*')
   *   .buildDefinition('super_admin', 'system');
   * ```
   */
  buildDefinition(id: string, tenantId: string = 'system'): RoleDefinition {
    const now = new Date();

    return {
      id,
      tenantId,
      name: this.input.name,
      displayName: this.input.displayName,
      description: this.input.description,
      type: this.input.type ?? 'custom',
      status: 'active',
      permissions: this.input.permissions ?? [],
      inherits: this.input.inherits,
      metadata: this.input.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * 创建角色构建器
 * 便捷的工厂函数
 *
 * @param name 角色名称
 * @returns 角色构建器实例
 *
 * @example
 * ```typescript
 * const builder = role('editor');
 * const input = builder.displayName('Editor').build();
 * ```
 */
export function role(name: string): RoleBuilder {
  return new RoleBuilder(name);
}

/**
 * 预定义系统角色
 * 提供常用的系统角色模板
 *
 * @example
 * ```typescript
 * // 获取超级管理员角色构建器
 * const adminBuilder = systemRoles.superAdmin();
 * const adminRole = adminBuilder.buildDefinition('super_admin');
 *
 * // 获取租户管理员角色构建器
 * const tenantAdminBuilder = systemRoles.tenantAdmin();
 *
 * // 获取访客角色构建器
 * const viewerBuilder = systemRoles.viewer();
 * ```
 */
export const systemRoles = {
  /**
   * 超级管理员角色
   * 拥有所有权限（通配符 *）
   *
   * @returns 角色构建器
   *
   * @example
   * ```typescript
   * const superAdmin = systemRoles.superAdmin()
   *   .buildDefinition('super_admin');
   * ```
   */
  superAdmin: () =>
    role('super_admin')
      .displayName('Super Administrator')
      .description('Full system access')
      .system()
      .permission('*'),

  /**
   * 租户管理员角色
   * 拥有租户的完全访问权限
   *
   * @returns 角色构建器
   *
   * @example
   * ```typescript
   * const tenantAdmin = systemRoles.tenantAdmin()
   *   .buildDefinition('tenant_admin');
   * ```
   */
  tenantAdmin: () =>
    role('tenant_admin')
      .displayName('Tenant Administrator')
      .description('Full tenant access')
      .system(),

  /**
   * 访客角色
   * 只读权限
   *
   * @returns 角色构建器
   *
   * @example
   * ```typescript
   * const viewer = systemRoles.viewer()
   *   .buildDefinition('viewer');
   * ```
   */
  viewer: () => role('viewer').displayName('Viewer').description('Read-only access').system(),
};
