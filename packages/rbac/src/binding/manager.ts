import type {
  BindingSubjectType,
  RBACStore,
  RoleBinding,
  RoleBindingCreateInput,
} from '../types.js';
import { validateBindingInput } from './validator.js';

/**
 * 角色绑定管理器
 * 处理角色与主体（用户、组、服务）的绑定关系
 *
 * 特性：
 * - 输入验证
 * - 自动处理过期绑定
 * - 防止重复绑定
 * - 自动权限缓存失效
 * - 支持批量操作
 *
 * @example
 * ```typescript
 * const manager = new BindingManager(store);
 *
 * // 分配角色
 * const binding = await manager.assignRole('tenant-001', {
 *   roleId: 'editor',
 *   subjectType: 'user',
 *   subjectId: 'user-123'
 * });
 *
 * // 检查角色
 * const hasRole = await manager.hasRole('tenant-001', 'editor', 'user', 'user-123');
 * ```
 */
export class BindingManager {
  /**
   * 数据存储后端
   */
  private store: RBACStore;

  /**
   * 创建绑定管理器
   * @param store RBAC 存储后端
   */
  constructor(store: RBACStore) {
    this.store = store;
  }

  /**
   * 分配角色
   * 将角色分配给指定的主体
   *
   * @param tenantId 租户 ID
   * @param input 绑定创建输入
   * @param createdBy 创建者 ID
   * @returns 创建的角色绑定
   * @throws Error 输入无效
   *
   * @example
   * ```typescript
   * const binding = await manager.assignRole('tenant-001', {
   *   roleId: 'editor',
   *   subjectType: 'user',
   *   subjectId: 'user-123',
   *   expiresAt: new Date('2025-12-31')
   * }, 'admin');
   * ```
   */
  async assignRole(
    tenantId: string,
    input: RoleBindingCreateInput,
    createdBy?: string
  ): Promise<RoleBinding> {
    // 验证输入
    validateBindingInput(input);

    // 检查绑定是否已存在
    const existing = await this.getExistingBinding(
      tenantId,
      input.roleId,
      input.subjectType,
      input.subjectId
    );

    if (existing) {
      // 如果绑定已存在且未过期，直接返回
      if (!existing.expiresAt || existing.expiresAt > new Date()) {
        return existing;
      }
      // 删除过期的绑定
      await this.store.deleteBinding(tenantId, existing.id);
    }

    // 使权限缓存失效
    await this.store.invalidatePermissions(tenantId, input.subjectId);

    return this.store.createBinding(tenantId, input, createdBy);
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
   * const revoked = await manager.revokeRole(
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
    const binding = await this.getExistingBinding(tenantId, roleId, subjectType, subjectId);

    if (!binding) {
      return false;
    }

    // 使权限缓存失效
    await this.store.invalidatePermissions(tenantId, subjectId);

    return this.store.deleteBinding(tenantId, binding.id);
  }

  /**
   * 撤销所有角色
   * 移除主体的所有角色绑定
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 撤销的绑定数量
   *
   * @example
   * ```typescript
   * const count = await manager.revokeAllRoles('tenant-001', 'user', 'user-123');
   * console.log(`撤销了 ${count} 个角色`);
   * ```
   */
  async revokeAllRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<number> {
    const bindings = await this.store.getSubjectBindings(tenantId, subjectType, subjectId);

    let count = 0;
    for (const binding of bindings) {
      const deleted = await this.store.deleteBinding(tenantId, binding.id);
      if (deleted) count++;
    }

    // 使权限缓存失效
    await this.store.invalidatePermissions(tenantId, subjectId);

    return count;
  }

  /**
   * 获取主体的角色
   * 获取指定主体的所有有效角色绑定（过滤掉过期的）
   *
   * @param tenantId 租户 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 角色绑定列表
   *
   * @example
   * ```typescript
   * const bindings = await manager.getSubjectRoles('tenant-001', 'user', 'user-123');
   * for (const binding of bindings) {
   *   console.log(`Role: ${binding.roleId}`);
   * }
   * ```
   */
  async getSubjectRoles(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding[]> {
    const bindings = await this.store.getSubjectBindings(tenantId, subjectType, subjectId);

    // 过滤掉已过期的绑定
    const now = new Date();
    return bindings.filter(b => !b.expiresAt || b.expiresAt > now);
  }

  /**
   * 获取角色的主体
   * 获取拥有指定角色的所有主体
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @returns 角色绑定列表
   *
   * @example
   * ```typescript
   * const bindings = await manager.getRoleSubjects('tenant-001', 'editor');
   * console.log(`有 ${bindings.length} 个用户拥有编辑角色`);
   * ```
   */
  async getRoleSubjects(tenantId: string, roleId: string): Promise<RoleBinding[]> {
    const bindings = await this.store.listBindings(tenantId, { roleId });

    // 过滤掉已过期的绑定
    const now = new Date();
    return bindings.filter(b => !b.expiresAt || b.expiresAt > now);
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
   * const isEditor = await manager.hasRole('tenant-001', 'editor', 'user', 'user-123');
   * if (isEditor) {
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
    const binding = await this.getExistingBinding(tenantId, roleId, subjectType, subjectId);

    if (!binding) {
      return false;
    }

    // 检查是否过期
    if (binding.expiresAt && binding.expiresAt <= new Date()) {
      return false;
    }

    return true;
  }

  /**
   * 设置绑定过期时间
   * 修改角色绑定的过期时间
   *
   * @param tenantId 租户 ID
   * @param bindingId 绑定 ID
   * @param expiresAt 新的过期时间，null 表示永久有效
   * @returns 更新后的绑定，不存在则返回 null
   *
   * @example
   * ```typescript
   * // 设置为 30 天后过期
   * await manager.setExpiration('tenant-001', 'bind-001', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
   *
   * // 设置为永久有效
   * await manager.setExpiration('tenant-001', 'bind-001', null);
   * ```
   */
  async setExpiration(
    tenantId: string,
    bindingId: string,
    expiresAt: Date | null
  ): Promise<RoleBinding | null> {
    const binding = await this.store.getBinding(tenantId, bindingId);

    if (!binding) {
      return null;
    }

    // 需要删除并重新创建以更新过期时间
    await this.store.deleteBinding(tenantId, bindingId);

    return this.store.createBinding(
      tenantId,
      {
        roleId: binding.roleId,
        subjectType: binding.subjectType,
        subjectId: binding.subjectId,
        expiresAt: expiresAt ?? undefined,
        metadata: binding.metadata,
      },
      binding.createdBy
    );
  }

  /**
   * 清理过期绑定
   * 删除所有已过期的角色绑定
   *
   * @param tenantId 租户 ID
   * @returns 清理的绑定数量
   *
   * @example
   * ```typescript
   * const count = await manager.cleanupExpired('tenant-001');
   * console.log(`清理了 ${count} 个过期绑定`);
   * ```
   */
  async cleanupExpired(tenantId: string): Promise<number> {
    const allBindings = await this.store.listBindings(tenantId, {});
    const now = new Date();
    let count = 0;

    for (const binding of allBindings) {
      if (binding.expiresAt && binding.expiresAt <= now) {
        await this.store.deleteBinding(tenantId, binding.id);
        count++;
      }
    }

    return count;
  }

  /**
   * 获取现有绑定
   * 获取指定角色和主体的绑定
   *
   * @param tenantId 租户 ID
   * @param roleId 角色 ID
   * @param subjectType 主体类型
   * @param subjectId 主体 ID
   * @returns 角色绑定或 null
   */
  private async getExistingBinding(
    tenantId: string,
    roleId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<RoleBinding | null> {
    const bindings = await this.store.listBindings(tenantId, {
      roleId,
      subjectType,
      subjectId,
    });

    return bindings[0] ?? null;
  }
}

/**
 * 创建绑定管理器
 * 便捷的工厂函数
 *
 * @param store RBAC 存储后端
 * @returns 绑定管理器实例
 *
 * @example
 * ```typescript
 * const manager = createBindingManager(store);
 * ```
 */
export function createBindingManager(store: RBACStore): BindingManager {
  return new BindingManager(store);
}
