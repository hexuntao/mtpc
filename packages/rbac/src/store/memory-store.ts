import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACStore,
  RoleBinding,
  RoleBindingCreateInput,
  RoleCreateInput,
  RoleDefinition,
  RoleStatus,
  RoleType,
  RoleUpdateInput,
} from '../types.js';

/**
 * 内存 RBAC 存储实现
 * 使用内存数据结构存储 RBAC 数据
 *
 * 特性：
 * - 快速读写操作（O(1) 查找复杂度）
 * - 自动生成唯一 ID
 * - 自动添加时间戳
 * - 支持角色继承的权限计算
 * - 自动清理关联绑定
 *
 * 限制：
 * - 数据不持久化（进程重启后丢失）
 * - 不适合生产环境的大规模应用
 * - 内存使用量随数据量线性增长
 *
 * 适用场景：
 * - 开发和测试环境
 * - 小型应用或原型
 * - 需要快速验证功能的场景
 *
 * @example
 * ```typescript
 * const store = new InMemoryRBACStore();
 *
 * // 创建角色
 * await store.createRole('tenant-001', {
 *   name: 'admin',
 *   permissions: ['*']
 * });
 *
 * // 创建绑定
 * await store.createBinding('tenant-001', {
 *   roleId: 'role-001',
 *   subjectType: 'user',
 *   subjectId: 'user-123'
 * });
 *
 * // 获取有效权限
 * const permissions = await store.getEffectivePermissions('tenant-001', 'user', 'user-123');
 * console.log(permissions.permissions);
 *
 * // 清空所有数据
 * store.clear();
 * ```
 */
export class InMemoryRBACStore implements RBACStore {
  /**
   * 角色存储
   * 键为角色 ID，值为角色定义
   */
  private roles: Map<string, RoleDefinition> = new Map();

  /**
   * 绑定存储
   * 键为绑定 ID，值为角色绑定
   */
  private bindings: Map<string, RoleBinding> = new Map();

  /**
   * ID 计数器
   * 用于生成唯一标识符
   */
  private idCounter = 0;

  /**
   * 生成唯一 ID
   * @returns 唯一标识符
   */
  private generateId(): string {
    return `rbac_${++this.idCounter}_${Date.now()}`;
  }

  // ============== 角色管理 ==============

  /**
   * 创建角色
   * 在存储中创建新的角色定义
   *
   * @param tenantId 租户 ID
   * @param input 角色创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色定义
   *
   * @example
   * ```typescript
   * const role = await store.createRole('tenant-001', {
   *   name: 'editor',
   *   displayName: 'Content Editor',
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
    const id = this.generateId();
    const now = new Date();

    const role: RoleDefinition = {
      id,
      tenantId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      type: input.type ?? 'custom',
      status: 'active',
      permissions: input.permissions ?? [],
      inherits: input.inherits,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    this.roles.set(id, role);
    return role;
  }

  /**
   * 更新角色
   * 更新现有角色的属性
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param input 角色更新输入
   * @returns 更新后的角色定义，不存在则返回 null
   *
   * @example
   * ```typescript
   * const updated = await store.updateRole('tenant-001', 'role-001', {
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
    const existing = this.roles.get(roleId);

    if (!existing || existing.tenantId !== tenantId) {
      return null;
    }

    const updated: RoleDefinition = {
      ...existing,
      ...input,
      id: roleId,
      tenantId,
      name: existing.name, // 名称不可更改
      type: existing.type, // 类型不可更改
      updatedAt: new Date(),
    };

    this.roles.set(roleId, updated);
    return updated;
  }

  /**
   * 删除角色
   * 删除指定角色及其所有关联绑定
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 是否删除成功
   *
   * @example
   * ```typescript
   * const deleted = await store.deleteRole('tenant-001', 'role-001');
   * // 注意：这会自动删除所有使用该角色的绑定
   * ```
   */
  async deleteRole(tenantId: string, roleId: string): Promise<boolean> {
    const existing = this.roles.get(roleId);

    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }

    this.roles.delete(roleId);

    // 删除该角色的所有绑定
    for (const [bindingId, binding] of this.bindings) {
      if (binding.roleId === roleId && binding.tenantId === tenantId) {
        this.bindings.delete(bindingId);
      }
    }

    return true;
  }

  /**
   * 获取角色
   * 根据 ID 获取角色定义
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 角色定义，不存在则返回 null
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleDefinition | null> {
    const role = this.roles.get(roleId);

    if (!role || role.tenantId !== tenantId) {
      return null;
    }

    return role;
  }

  /**
   * 根据名称获取角色
   * 在指定租户下查找特定名称的角色
   *
   * @param tenantId 租户 ID
   * @param name 角色名称
   * @returns 角色定义，不存在则返回 null
   */
  async getRoleByName(tenantId: string, name: string): Promise<RoleDefinition | null> {
    for (const role of this.roles.values()) {
      if (role.tenantId === tenantId && role.name === name) {
        return role;
      }
    }
    return null;
  }

  /**
   * 列出角色
   * 获取租户下的所有角色，支持筛选
   *
   * @param tenantId 租户 ID
   * @param options 筛选选项
   * @returns 角色定义列表
   */
  async listRoles(
    tenantId: string,
    options?: { status?: RoleStatus; type?: RoleType }
  ): Promise<RoleDefinition[]> {
    const roles: RoleDefinition[] = [];

    for (const role of this.roles.values()) {
      if (role.tenantId !== tenantId) continue;
      if (options?.status && role.status !== options.status) continue;
      if (options?.type && role.type !== options.type) continue;
      roles.push(role);
    }

    return roles;
  }

  // ============== 角色绑定 ==============

  /**
   * 创建角色绑定
   * 创建角色与主体的绑定关系
   *
   * @param tenantId 租户 ID
   * @param input 绑定创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色绑定
   */
  async createBinding(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding> {
    const id = this.generateId();
    const now = new Date();

    const binding: RoleBinding = {
      id,
      tenantId,
      roleId: input.roleId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
      createdAt: now,
      createdBy,
    };

    this.bindings.set(id, binding);
    return binding;
  }

  /**
   * 删除角色绑定
   * 删除指定的角色绑定
   *
   * @param tenantId 租户 ID
   * @param bindingId 绑定 ID
   * @returns 是否删除成功
   */
  async deleteBinding(tenantId: string, bindingId: string): Promise<boolean> {
    const existing = this.bindings.get(bindingId);

    if (!existing || existing.tenantId !== tenantId) {
      return false;
    }

    this.bindings.delete(bindingId);
    return true;
  }

  /**
   * 获取角色绑定
   * 根据 ID 获取角色绑定
   *
   * @param tenantId 租户 ID
   * @param bindingId 绑定 ID
   * @returns 角色绑定，不存在则返回 null
   */
  async getBinding(tenantId: string, bindingId: string): Promise<RoleBinding | null> {
    const binding = this.bindings.get(bindingId);

    if (!binding || binding.tenantId !== tenantId) {
      return null;
    }

    return binding;
  }

  /**
   * 列出角色绑定
   * 获取租户下的所有绑定，支持筛选
   *
   * @param tenantId 租户 ID
   * @param options 筛选选项
   * @returns 角色绑定列表
   */
  async listBindings(
    tenantId: string,
    options?: { roleId?: string; subjectId?: string; subjectType?: BindingSubjectType }
  ): Promise<RoleBinding[]> {
    const bindings: RoleBinding[] = [];

    for (const binding of this.bindings.values()) {
      if (binding.tenantId !== tenantId) continue;
      if (options?.roleId && binding.roleId !== options.roleId) continue;
      if (options?.subjectId && binding.subjectId !== options.subjectId) continue;
      if (options?.subjectType && binding.subjectType !== options.subjectType) continue;
      bindings.push(binding);
    }

    return bindings;
  }

  /**
   * 获取主体的角色绑定
   * 获取指定主体的所有角色绑定
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 角色绑定列表
   */
  async getSubjectBindings(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    return this.listBindings(tenantId, { subjectType, subjectId });
  }

  // ============== 权限管理 ==============

  /**
   * 获取有效权限
   * 计算主体的所有有效权限（包括继承权限）
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 有效权限结果
   */
  async getEffectivePermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<EffectivePermissions> {
    const bindings = await this.getSubjectBindings(tenantId, subjectType, subjectId);
    const permissions = new Set<string>();
    const roleIds: string[] = [];
    const now = new Date();

    // 收集所有有效绑定的权限
    for (const binding of bindings) {
      // 跳过已过期的绑定
      if (binding.expiresAt && binding.expiresAt <= now) {
        continue;
      }

      const role = await this.getRole(tenantId, binding.roleId);
      if (!role || role.status !== 'active') {
        continue;
      }

      roleIds.push(role.id);

      // 添加直接权限
      for (const perm of role.permissions) {
        permissions.add(perm);
      }

      // 添加继承权限
      if (role.inherits) {
        const inheritedPerms = await this.getInheritedPermissions(tenantId, role.inherits);
        for (const perm of inheritedPerms) {
          permissions.add(perm);
        }
      }
    }

    return {
      tenantId,
      subjectId,
      subjectType,
      roles: roleIds,
      permissions,
      computedAt: now,
    };
  }

  /**
   * 获取继承权限
   * 递归获取角色继承链中的所有权限
   *
   * @param tenantId 租户 ID
   * @param roleIds 要查询的角色 ID 列表
   * @param visited 已访问的角色（防止循环继承）
   * @returns 权限集合
   */
  private async getInheritedPermissions(
    tenantId: string,
    roleIds: string[],
    visited: Set<string> = new Set()
  ): Promise<Set<string>> {
    const permissions = new Set<string>();

    for (const roleId of roleIds) {
      // 防止循环继承
      if (visited.has(roleId)) continue;
      visited.add(roleId);

      const role = await this.getRole(tenantId, roleId);
      if (!role || role.status !== 'active') continue;

      // 添加当前角色的权限
      for (const perm of role.permissions) {
        permissions.add(perm);
      }

      // 递归获取继承的权限
      if (role.inherits) {
        const inherited = await this.getInheritedPermissions(tenantId, role.inherits, visited);
        for (const perm of inherited) {
          permissions.add(perm);
        }
      }
    }

    return permissions;
  }

  /**
   * 使权限缓存失效
   * 内存存储不需要缓存失效操作，这是空实现
   *
   * @param _tenantId 租户 ID（未使用）
   * @param _subjectId 主体 ID（未使用）
   */
  async invalidatePermissions(_tenantId: string, _subjectId?: string): Promise<void> {
    // 内存存储不需要缓存失效
    // 这是空实现，但为了满足接口要求而保留
  }

  // ============== 工具方法 ==============

  /**
   * 清空所有数据
   * 删除所有角色和绑定，重置 ID 计数器
   *
   * @example
   * ```typescript
   * store.clear();
   * console.log('所有数据已清空');
   * ```
   */
  clear(): void {
    this.roles.clear();
    this.bindings.clear();
    this.idCounter = 0;
  }
}

/**
 * 创建内存 RBAC 存储
 * 便捷的工厂函数
 *
 * @returns 内存存储实例
 *
 * @example
 * ```typescript
 * const store = createInMemoryRBACStore();
 * await store.createRole('tenant-001', { name: 'admin' });
 * ```
 */
export function createInMemoryRBACStore(): InMemoryRBACStore {
  return new InMemoryRBACStore();
}
