import { createPermissionCode, PermissionDeniedError, parsePermissionCode } from '@mtpc/shared';
import { InvalidTenantError, MissingTenantContextError } from '@mtpc/shared/errors';
import type {
  BatchPermissionCheckResult,
  PermissionCheckContext,
  PermissionCheckResult,
} from '../types/index.js';

/**
 * 信号量类，用于控制并发数量
 * 限制同时执行的任务数量，避免系统过载
 */
class Semaphore {
  private permits: number;
  private waiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  constructor(maxPermits: number) {
    this.permits = maxPermits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve, reject) => {
      const release = () => {
        this.permits++;
        if (this.waiters.length > 0) {
          const waiter = this.waiters.shift()!;
          waiter.resolve();
        }
      };

      if (this.permits > 0) {
        this.permits--;
        resolve(release);
      } else {
        this.waiters.push({
          resolve: () => {
            this.permits--;
            resolve(release);
          },
          reject,
        });
      }
    });
  }
}

/**
 * 权限检查器
 * 负责检查主体是否具有执行特定操作的权限
 * 支持多种权限检查模式：直接权限、通配符权限、外部解析器等
 *
 * @example
 * ```typescript
 * // 创建权限检查器
 * const checker = new PermissionChecker(async (tenantId, subjectId) => {
 *   // 从数据库或缓存获取权限集合
 *   return await getPermissionsFromDB(tenantId, subjectId);
 * });
 *
 * // 检查单个权限
 * const result = await checker.check({
 *   tenant: { id: 'tenant-1' },
 *   subject: { id: 'user-123', type: 'user' },
 *   resource: 'user',
 *   action: 'create'
 * });
 *
 * if (result.allowed) {
 *   // 有权限，执行操作
 * } else {
 *   // 无权限，拒绝操作
 * }
 * ```
 */
export class PermissionChecker {
  /** 权限解析器：从外部源（数据库/缓存）获取权限集合 */
  private permissionResolver: (tenantId: string, subjectId: string) => Promise<Set<string>>;

  /** 权限缓存：用于提高性能 */
  private cache = new Map<string, { permissions: Set<string>; expiresAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 创建权限检查器
   * @param resolver 权限解析器函数，接收租户ID和主体ID，返回权限集合
   */
  constructor(resolver: (tenantId: string, subjectId: string) => Promise<Set<string>>) {
    this.permissionResolver = resolver;
  }

  /**
   * 检查单个权限
   * 按以下优先级进行检查：
   * 1. 系统主体（system）拥有所有权限
   * 2. 主体直接权限（包含通配符 '*'）
   * 3. 缓存或外部解析器权限：全局通配符 '*'
   * 4. 缓存或外部解析器权限：资源通配符 'resource:*'
   * 5. 缓存或外部解析器权限：具体权限 'resource:action'
   * 6. 默认拒绝
   *
   * @param context 权限检查上下文
   * @returns 权限检查结果
   *
   * @example
   * ```typescript
   * const result = await checker.check({
   *   tenant: { id: 'tenant-1' },
   *   subject: { id: 'user-123', type: 'user', permissions: ['user:read'] },
   *   resource: 'user',
   *   action: 'read'
   * });
   * // 返回: { allowed: true, permission: 'user:read', reason: 'Direct permission on subject', ... }
   * ```
   */
  async check(context: PermissionCheckContext): Promise<PermissionCheckResult> {
    const startTime = Date.now();
    const permissionCode = createPermissionCode(context.resource, context.action);

    // ========== 入口验证：Tenant Context 不可缺失 ==========
    // 符合 Architecture.md - "Fail-safe" 原则
    if (!context.tenant) {
      throw new MissingTenantContextError();
    }
    if (!context.tenant.id || typeof context.tenant.id !== 'string') {
      throw new InvalidTenantError('Tenant ID must be a non-empty string');
    }
    // ======================================================

    // 1. 系统主体拥有所有权限
    if (context.subject.type === 'system') {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'System subject has full access',
        evaluationTime: Date.now() - startTime,
      };
    }

    // 2. 检查主体直接权限
    if (
      context.subject.permissions?.includes(permissionCode) ||
      context.subject.permissions?.includes('*')
    ) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Direct permission on subject',
        evaluationTime: Date.now() - startTime,
      };
    }

    // 3. 从缓存或外部源解析权限（数据库、缓存等）
    const cacheKey = `${context.tenant.id}:${context.subject.id}`;
    let permissions: Set<string>;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      // 使用缓存
      permissions = cached.permissions;
    } else {
      // 从外部源解析并缓存
      // 异常处理：resolver 失败时返回空权限集（Fail-safe）
      try {
        permissions = await this.permissionResolver(context.tenant.id, context.subject.id);
        // 确保返回 Set 类型
        if (!(permissions instanceof Set)) {
          permissions = new Set();
        }
      } catch {
        // resolver 异常时返回空权限集，等同于"无权限"
        // 这符合 Fail-safe 原则：任何异常路径都导向拒绝
        permissions = new Set();
      }
      this.cache.set(cacheKey, {
        permissions,
        expiresAt: Date.now() + this.CACHE_TTL,
      });
    }

    // 4. 检查全局通配符权限 '*'
    if (permissions.has('*')) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Wildcard permission',
        evaluationTime: Date.now() - startTime,
      };
    }

    // 5. 检查资源通配符权限 'resource:*'
    const resourceWildcard = `${context.resource}:*`;
    if (permissions.has(resourceWildcard)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Resource wildcard permission',
        evaluationTime: Date.now() - startTime,
      };
    }

    // 6. 检查具体权限 'resource:action'
    if (permissions.has(permissionCode)) {
      return {
        allowed: true,
        permission: permissionCode,
        reason: 'Specific permission granted',
        evaluationTime: Date.now() - startTime,
      };
    }

    // 默认拒绝
    return {
      allowed: false,
      permission: permissionCode,
      reason: 'Permission not granted',
      evaluationTime: Date.now() - startTime,
    };
  }

  /**
   * 检查权限并在无权限时抛出异常
   * 便捷方法，用于需要立即拒绝无权限请求的场景
   *
   * @param context 权限检查上下文
   * @throws PermissionDeniedError 当权限检查失败时
   *
   * @example
   * ```typescript
   * try {
   *   await checker.checkOrThrow({
   *     tenant: { id: 'tenant-1' },
   *     subject: { id: 'user-123', type: 'user' },
   *     resource: 'user',
   *     action: 'delete'
   *   });
   *   // 有权限，继续执行
   * } catch (error) {
   *   // 无权限，错误已包含详细信息
   *   console.error(error.message);
   * }
   * ```
   */
  async checkOrThrow(context: PermissionCheckContext): Promise<void> {
    const result = await this.check(context);

    if (!result.allowed) {
      throw new PermissionDeniedError(result.permission, {
        reason: result.reason,
        tenantId: context.tenant.id,
        subjectId: context.subject.id,
      });
    }
  }

  /**
   * 批量检查多个权限
   * 一次性检查多个权限，返回详细的检查结果
   * 支持并行执行以提高性能，可配置并发限制
   *
   * @param contexts 权限检查上下文数组
   * @param options 可选配置：是否并行执行和最大并发数
   * @returns 批量检查结果，包含每个权限的详细结果和汇总信息
   *
   * @example
   * ```typescript
   * // 默认并行执行（最多10个并发）
   * const results = await checker.checkMany([
   *   { tenant, subject, resource: 'user', action: 'create' },
   *   { tenant, subject, resource: 'user', action: 'read' },
   *   { tenant, subject, resource: 'user', action: 'delete' }
   * ]);
   *
   * // 自定义并发限制
   * const results = await checker.checkMany(contexts, {
   *   parallel: true,
   *   maxConcurrency: 5
   * });
   *
   * // 串行执行
   * const results = await checker.checkMany(contexts, {
   *   parallel: false
   * });
   *
   * // 检查所有权限是否都允许
   * if (results.allAllowed) {
   *   console.log('用户拥有所有权限');
   * }
   *
   * // 检查是否有任意权限允许
   * if (results.anyAllowed) {
   *   console.log('用户拥有部分权限');
   * }
   * ```
   */
  async checkMany(
    contexts: PermissionCheckContext[],
    options: { parallel?: boolean; maxConcurrency?: number } = {}
  ): Promise<BatchPermissionCheckResult> {
    const { parallel = true, maxConcurrency = 10 } = options;
    const results = new Map<string, PermissionCheckResult>();

    // 输入验证
    if (!contexts || !Array.isArray(contexts)) {
      throw new Error('contexts 必须是一个数组');
    }

    if (contexts.length === 0) {
      return { results: new Map(), allAllowed: true, anyAllowed: false };
    }

    if (parallel) {
      // 并行执行（带并发限制）
      const semaphore = new Semaphore(maxConcurrency);
      const tasks = contexts.map(async context => {
        const release = await semaphore.acquire();
        try {
          const code = createPermissionCode(context.resource, context.action);
          const result = await this.check(context);
          return { code, result };
        } finally {
          release();
        }
      });

      const taskResults = await Promise.all(tasks);
      for (const { code, result } of taskResults) {
        results.set(code, result);
      }
    } else {
      // 串行执行（原有逻辑）
      for (const context of contexts) {
        const code = createPermissionCode(context.resource, context.action);
        const result = await this.check(context);
        results.set(code, result);
      }
    }

    const allAllowed = Array.from(results.values()).every(r => r.allowed);
    const anyAllowed = Array.from(results.values()).some(r => r.allowed);

    return { results, allAllowed, anyAllowed };
  }

  /**
   * 检查是否拥有任意一个权限（短路评估）
   * 一旦找到第一个允许的权限就返回 true，性能优化
   *
   * @param context 基础上下文（不包含 resource 和 action）
   * @param permissions 要检查的权限代码数组
   * @returns 是否拥有任意一个权限
   *
   * @example
   * ```typescript
   * const hasAccess = await checker.hasAny(
   *   { tenant: { id: 'tenant-1' }, subject: { id: 'user-123', type: 'user' } },
   *   ['admin:*', 'user:delete', 'order:read']
   * );
   * // 如果用户有 admin:* 或 user:delete 或 order:read 中的任意一个，返回 true
   * ```
   */
  async hasAny(
    context: Omit<PermissionCheckContext, 'resource' | 'action'>,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      const parsed = parsePermissionCode(permission);
      if (!parsed) continue;

      const result = await this.check({
        ...context,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (result.allowed) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查是否拥有所有权限
   * 必须拥有所有指定的权限才返回 true
   *
   * @param context 基础上下文（不包含 resource 和 action）
   * @param permissions 要检查的权限代码数组
   * @returns 是否拥有所有权限
   *
   * @example
   * ```typescript
   * const hasAllAccess = await checker.hasAll(
   *   { tenant: { id: 'tenant-1' }, subject: { id: 'user-123', type: 'user' } },
   *   ['user:read', 'user:update']
   * );
   * // 只有同时拥有 user:read 和 user:update，才返回 true
   * ```
   */
  async hasAll(
    context: Omit<PermissionCheckContext, 'resource' | 'action'>,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      const parsed = parsePermissionCode(permission);
      if (!parsed) return false;

      const result = await this.check({
        ...context,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (!result.allowed) {
        return false;
      }
    }

    return true;
  }
}

/**
 * 创建简单的权限检查器（使用静态权限）
 * 便捷工厂函数，适用于权限数据不经常变化的场景
 *
 * @param getPermissions 权限获取函数，返回权限集合（同步或异步）
 * @returns 权限检查器实例
 *
 * @example
 * ```typescript
 * // 静态权限配置
 * const staticPermissions = new Map([
 *   ['user-123', new Set(['user:read', 'user:update'])],
 *   ['user-456', new Set(['*'])]
 * ]);
 *
 * const checker = createSimpleChecker((tenantId, subjectId) => {
 *   return staticPermissions.get(subjectId) || new Set();
 * });
 * ```
 */
export function createSimpleChecker(
  getPermissions: (tenantId: string, subjectId: string) => Set<string> | Promise<Set<string>>
): PermissionChecker {
  return new PermissionChecker(async (tenantId, subjectId) => {
    const result = getPermissions(tenantId, subjectId);
    // 确保返回 Promise
    return result instanceof Promise ? result : Promise.resolve(result);
  });
}

/**
 * 创建允许所有权限的检查器
 * 便捷工厂函数，适用于测试或特殊场景
 *
 * @returns 总是允许的权限检查器
 *
 * @example
 * ```typescript
 * const allowAllChecker = createAllowAllChecker();
 * const result = await allowAllChecker.check({
 *   tenant, subject, resource: 'any', action: 'any'
 * });
 * // result.allowed 总是 true
 * ```
 */
export function createAllowAllChecker(): PermissionChecker {
  return new PermissionChecker(async () => new Set(['*']));
}

/**
 * 创建拒绝所有权限的检查器
 * 便捷工厂函数，适用于测试或严格权限控制场景
 *
 * @returns 总是拒绝的权限检查器
 *
 * @example
 * ```typescript
 * const denyAllChecker = createDenyAllChecker();
 * const result = await denyAllChecker.check({
 *   tenant, subject, resource: 'any', action: 'any'
 * });
 * // result.allowed 总是 false
 * ```
 */
export function createDenyAllChecker(): PermissionChecker {
  return new PermissionChecker(async () => new Set());
}
