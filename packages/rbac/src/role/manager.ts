import type {
  RBACStore,
  RoleCreateInput,
  RoleDefinition,
  RoleStatus,
  RoleType,
  RoleUpdateInput,
} from '../types.js';
import { validateRoleInput } from './validator.js';

/**
 * 角色管理器
 * 提供角色的 CRUD 操作和高级管理功能
 *
 * 特性：
 * - 输入验证
 * - 系统角色保护
 * - 角色名称唯一性检查
 * - 自动权限缓存失效
 * - 角色克隆功能
 * - 角色权限计算（包含继承）
 *
 * @example
 * ```typescript
 * const manager = new RoleManager(store);
 *
 * // 创建角色
 * const role = await manager.createRole('tenant-001', {
 *   name: 'editor',
 *   permissions: ['content:read', 'content:write']
 * });
 *
 * // 获取角色权限（包含继承）
 * const permissions = await manager.getRolePermissions('tenant-001', 'role-001');
 * ```
 */
export class RoleManager {
  /**
   * 数据存储后端
   */
  private store: RBACStore;

  /**
   * 系统角色注册表
   * 存储所有系统角色的定义
   */
  private systemRoles: Map<string, RoleDefinition> = new Map();

  /**
   * 创建角色管理器
   * @param store RBAC 存储后端
   */
  constructor(store: RBACStore) {
    this.store = store;
  }

  /**
   * 注册系统角色
   * 将角色添加到系统角色注册表
   *
   * @param role 角色定义
   * @throws Error 如果角色类型不是 'system'
   *
   * @example
   * ```typescript
   * manager.registerSystemRole({
   *   id: 'super_admin',
   *   name: 'super_admin',
   *   type: 'system',
   *   // ...
   * });
   * ```
   */
  registerSystemRole(role: RoleDefinition): void {
    if (role.type !== 'system') {
      throw new Error('Only system roles can be registered');
    }
    this.systemRoles.set(role.id, role);
  }

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
   * const role = await manager.createRole('tenant-001', {
   *   name: 'editor',
   *   displayName: 'Content Editor',
   *   permissions: ['content:read', 'content:write']
   * }, 'admin');
   * ```
   */
  async createRole(
    tenantId: string,
    input: RoleCreateInput,
    createdBy?: string
  ): Promise<RoleDefinition> {
    // 验证输入
    validateRoleInput(input);

    // 检查名称是否已存在
    const existing = await this.store.getRoleByName(tenantId, input.name);
    if (existing) {
      throw new Error(`Role with name "${input.name}" already exists`);
    }

    return this.store.createRole(tenantId, input, createdBy);
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
   * const updated = await manager.updateRole('tenant-001', 'role-001', {
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
    const existing = await this.store.getRole(tenantId, roleId);

    if (!existing) {
      return null;
    }

    // 防止修改系统角色
    if (existing.type === 'system') {
      throw new Error('Cannot modify system roles');
    }

    // 使权限缓存失效
    await this.store.invalidatePermissions(tenantId);

    return this.store.updateRole(tenantId, roleId, input);
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
   * const deleted = await manager.deleteRole('tenant-001', 'role-001');
   * ```
   */
  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const existing = await this.store.getRole(tenantId, roleId);

    if (!existing) {
      return false;
    }

    // 防止删除系统角色
    if (existing.type === 'system') {
      throw new Error('Cannot delete system roles');
    }

    // 使权限缓存失效
    await this.store.invalidatePermissions(tenantId);

    return this.store.deleteRole(tenantId, roleId);
  }

  /**
   * 获取角色
   * 根据 ID 获取角色定义
   * 优先从系统角色注册表获取
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 角色定义，不存在则返回 null
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    // 优先检查系统角色
    const systemRole = this.systemRoles.get(roleId);
    if (systemRole) {
      return { ...systemRole, tenantId };
    }

    return this.store.getRole(tenantId, roleId);
  }

  /**
   * 根据名称获取角色
   * 在指定租户下查找特定名称的角色
   * 优先从系统角色注册表获取
   *
   * @param tenantId 租户 ID
   * @param name 角色名称
   * @returns 角色定义，不存在则返回 null
   */
  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    // 优先检查系统角色
    for (const role of this.systemRoles.values()) {
      if (role.name === name) {
        return { ...role, tenantId };
      }
    }

    return this.store.getRoleByName(tenantId, name);
  }

  /**
   * 列出角色
   * 获取租户下的所有角色，支持筛选
   * 自动包含系统角色
   *
   * @param tenantId 租户 ID
   * @param options 筛选选项
   * @returns 角色定义列表
   */
  async listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]> {
    const storeRoles = await this.store.listRoles(tenantId, options);

    // 如果未按类型筛选或类型为 system，包含系统角色
    if (!options?.type || options.type === 'system') {
      const systemRoles = Array.from(this.systemRoles.values())
        .filter(r => !options?.status || r.status === options.status)
        .map(r => ({ ...r, tenantId }));

      return [...systemRoles, ...storeRoles];
    }

    return storeRoles;
  }

  /**
   * 获取角色权限
   * 获取角色的所有权限，包括继承的权限
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 权限集合
   *
   * @example
   * ```typescript
   * const permissions = await manager.getRolePermissions('tenant-001', 'editor');
   * console.log(Array.from(permissions)); // ['content:read', 'content:write', ...]
   * ```
   */
  async getRolePermissions(tenantId: string, roleId: string): Promise<Set<string>> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return new Set();
    }

    const permissions = new Set(role.permissions);

    // 递归添加继承权限
    if (role.inherits && role.inherits.length > 0) {
      for (const parentRoleId of role.inherits) {
        const parentPermissions = await this.getRolePermissions(tenantId, parentRoleId);
        for (const perm of parentPermissions) {
          permissions.add(perm);
        }
      }
    }

    return permissions;
  }

  /**
   * 添加权限到角色
   * 向角色添加单个权限
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param permission 要添加的权限
   * @returns 更新后的角色定义，不存在则返回 null
   *
   * @example
   * ```typescript
   * await manager.addPermission('tenant-001', 'editor', 'content:publish');
   * ```
   */
  async addPermission(
    tenantId: string,
    roleId: string,
    permission: string
  ): Promise<RoleDefinition | null> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return null;
    }

    // 如果权限已存在，直接返回
    if (role.permissions.includes(permission)) {
      return role;
    }

    return this.updateRole(tenantId, roleId, {
      permissions: [...role.permissions, permission],
    });
  }

  /**
   * 从角色移除权限
   * 从角色中移除指定的权限
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param permission 要移除的权限
   * @returns 更新后的角色定义，不存在则返回 null
   *
   * @example
   * ```typescript
   * await manager.removePermission('tenant-001', 'editor', 'content:delete');
   * ```
   */
  async removePermission(
    tenantId: string,
    roleId: string,
    permission: string
  ): Promise<RoleDefinition | null> {
    const role = await this.getRole(tenantId, roleId);

    if (!role) {
      return null;
    }

    return this.updateRole(tenantId, roleId, {
      permissions: role.permissions.filter(p => p !== permission),
    });
  }

  /**
   * 设置角色权限
   * 完全替换角色的权限列表
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param permissions 新的权限列表
   * @returns 更新后的角色定义，不存在则返回 null
   *
   * @example
   * ```typescript
   * await manager.setPermissions('tenant-001', 'editor', [
   *   'content:read',
   *   'content:write',
   *   'content:publish'
   * ]);
   * ```
   */
  async setPermissions(
    tenantId: string,
    roleId: string,
    permissions: string[]
  ): Promise<RoleDefinition | null> {
    return this.updateRole(tenantId, roleId, { permissions });
  }

  /**
   * 克隆角色
   * 基于现有角色创建新的自定义角色
   *
   * @param tenantId 租户 ID
   * @param sourceRoleId 源角色 ID
   * @param newName 新角色名称
   * @param createdBy 创建者 ID
   * @returns 创建的新角色定义
   * @throws Error 源角色不存在
   *
   * @example
   * ```typescript
   * const cloned = await manager.cloneRole(
   *   'tenant-001',
   *   'editor',
   *   'senior_editor',
   *   'admin'
   * );
   * ```
   */
  async cloneRole(
    tenantId: string,
    sourceRoleId: string,
    newName: string,
    createdBy?: string
  ): Promise<RoleDefinition> {
    const source = await this.getRole(tenantId, sourceRoleId);

    if (!source) {
      throw new Error(`Source role not found: ${sourceRoleId}`);
    }

    return this.createRole(
      tenantId,
      {
        name: newName,
        displayName: `${source.displayName ?? source.name} (Copy)`,
        description: source.description,
        type: 'custom',
        permissions: [...source.permissions],
        inherits: source.inherits ? [...source.inherits] : undefined,
        metadata: source.metadata ? { ...source.metadata } : undefined,
      },
      createdBy
    );
  }
}

/**
 * 创建角色管理器
 * 便捷的工厂函数
 *
 * @param store RBAC 存储后端
 * @returns 角色管理器实例
 *
 * @example
 * ```typescript
 * const manager = createRoleManager(store);
 * ```
 */
export function createRoleManager(store: RBACStore): RoleManager {
  return new RoleManager(store);
}
