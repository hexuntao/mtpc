import { matchesPattern } from '@mtpc/core';
import type {
  BindingSubjectType,
  EffectivePermissions,
  RBACCheckContext,
  RBACCheckResult,
  RBACStore,
} from '../types.js';

/**
 * RBAC 权限评估器
 * 负责执行权限检查和计算有效权限
 *
 * 特性：
 * - 支持权限模式匹配（通配符）
 * - 内置缓存机制提高性能
 * - 自动缓存过期管理
 * - 支持批量权限检查
 *
 * @example
 * ```typescript
 * const evaluator = new RBACEvaluator(store, { cacheTTL: 60000 });
 *
 * // 检查权限
 * const result = await evaluator.check({
 *   tenant: { id: 'tenant-001' },
 *   subject: { id: 'user-123', type: 'user' },
 *   permission: 'content:write'
 * });
 *
 * if (result.allowed) {
 *   console.log('权限授予:', result.matchedRoles);
 * }
 * ```
 */
export class RBACEvaluator {
  /**
   * 数据存储后端
   */
  private store: RBACStore;

  /**
   * 权限缓存
   * 键为 `tenantId:subjectType:subjectId`，值为权限结果
   */
  private cache: Map<string, EffectivePermissions> = new Map();

  /**
   * 缓存生存时间（毫秒）
   * 默认 60000（1 分钟）
   */
  private cacheTTL: number;

  /**
   * 创建 RBAC 权限评估器
   * @param store RBAC 存储后端
   * @param options 配置选项
   * @param options.cacheTTL 缓存生存时间（毫秒），默认 60000
   */
  constructor(store: RBACStore, options: { cacheTTL?: number } = {}) {
    this.store = store;
    this.cacheTTL = options.cacheTTL ?? 60000; // 默认 1 分钟
  }

  /**
   * 检查权限
   * 检查主体是否拥有指定的权限
   *
   * @param context 权限检查上下文
   * @returns 权限检查结果
   *
   * @example
   * ```typescript
   * const result = await evaluator.check({
   *   tenant: { id: 'tenant-001' },
   *   subject: { id: 'user-123', type: 'user' },
   *   permission: 'content:write'
   * });
   *
   * console.log(result.allowed); // true/false
   * console.log(result.matchedRoles); // ['editor', 'admin']
   * console.log(result.reason); // 'Granted by roles: editor, admin'
   * ```
   */
  async check(context: RBACCheckContext): Promise<RBACCheckResult> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    const matchedRoles: string[] = [];
    let allowed = false;

    // 检查权限是否被授予
    for (const perm of effectivePerms.permissions) {
      if (matchesPattern(context.permission, perm)) {
        allowed = true;
        break;
      }
    }

    // 获取匹配的角色
    if (allowed) {
      matchedRoles.push(...effectivePerms.roles);
    }

    return {
      allowed,
      matchedRoles,
      reason: allowed
        ? `Granted by roles: ${matchedRoles.join(', ')}`
        : 'Permission not granted by any role',
    };
  }

  /**
   * 获取有效权限
   * 获取主体的所有有效权限（包括继承权限）
   * 结果会被缓存以提高性能
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
    const cacheKey = `${tenantId}:${subjectType}:${subjectId}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      return cached;
    }

    // 从存储获取
    const effectivePerms = await this.store.getEffectivePermissions(
      tenantId,
      subjectType,
      subjectId
    );

    // 设置缓存过期时间
    effectivePerms.expiresAt = new Date(Date.now() + this.cacheTTL);

    // 缓存结果
    this.cache.set(cacheKey, effectivePerms);

    return effectivePerms;
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
   * const permissions = await evaluator.getPermissions('tenant-001', 'user', 'user-123');
   * console.log(permissions); // ['content:read', 'content:write', ...]
   * ```
   */
  async getPermissions(
    tenantId: string,
    subjectType: BindingSubjectType,
    subjectId: string
  ): Promise<string[]> {
    const effective = await this.getEffectivePermissions(tenantId, subjectType, subjectId);
    return Array.from(effective.permissions);
  }

  /**
   * 检查是否拥有任意权限
   * 检查主体是否拥有指定权限中的至少一个
   *
   * @param context 权限检查上下文（不包含 permission 字段）
   * @param permissions 要检查的权限列表
   * @returns 是否拥有至少一个权限
   *
   * @example
   * ```typescript
   * const hasAny = await evaluator.hasAnyPermission(
   *   { tenant, subject },
   *   ['content:write', 'content:delete']
   * );
   * ```
   */
  async hasAnyPermission(
    context: Omit<RBACCheckContext, 'permission'>,
    permissions: string[]
  ): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    for (const required of permissions) {
      for (const perm of effectivePerms.permissions) {
        if (matchesPattern(required, perm)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查是否拥有所有权限
   * 检查主体是否拥有指定的所有权限
   *
   * @param context 权限检查上下文（不包含 permission 字段）
   * @param permissions 要检查的权限列表
   * @returns 是否拥有所有权限
   *
   * @example
   * ```typescript
   * const hasAll = await evaluator.hasAllPermissions(
   *   { tenant, subject },
   *   ['content:read', 'content:write']
   * );
   * ```
   */
  async hasAllPermissions(
    context: Omit<RBACCheckContext, 'permission'>,
    permissions: string[]
  ): Promise<boolean> {
    const effectivePerms = await this.getEffectivePermissions(
      context.tenant.id,
      context.subject.type as BindingSubjectType,
      context.subject.id
    );

    for (const required of permissions) {
      let found = false;
      for (const perm of effectivePerms.permissions) {
        if (matchesPattern(required, perm)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }

    return true;
  }

  /**
   * 使缓存失效
   * 清除指定租户或主体的权限缓存
   *
   * @param tenantId 租户 ID
   * @param subjectId 主体 ID，未指定则清除整个租户的缓存
   *
   * @example
   * ```typescript
   * // 清除特定用户的缓存
   * evaluator.invalidate('tenant-001', 'user-123');
   *
   * // 清除整个租户的缓存
   * evaluator.invalidate('tenant-001');
   * ```
   */
  invalidate(tenantId: string, subjectId?: string): void {
    if (subjectId) {
      // 清除特定主体的缓存
      const prefix = `${tenantId}:`;
      const suffix = `:${subjectId}`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix) && key.endsWith(suffix)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除整个租户的缓存
      const prefix = `${tenantId}:`;

      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * 清空所有缓存
   * 清除所有租户和主体的权限缓存
   *
   * @example
   * ```typescript
   * evaluator.clearCache();
   * console.log('所有缓存已清除');
   * ```
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 创建 RBAC 权限评估器
 * 便捷的工厂函数
 *
 * @param store RBAC 存储后端
 * @param options 配置选项
 * @returns RBAC 权限评估器实例
 *
 * @example
 * ```typescript
 * const evaluator = createRBACEvaluator(store, { cacheTTL: 300000 });
 * ```
 */
export function createRBACEvaluator(
  store: RBACStore,
  options?: { cacheTTL?: number }
): RBACEvaluator {
  return new RBACEvaluator(store, options);
}
