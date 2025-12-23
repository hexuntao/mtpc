import { InvalidTenantError, MissingTenantContextError } from '@mtpc/shared';
import type { TenantContext, TenantStatus } from '../types/index.js';

/**
 * 创建租户上下文
 * 根据提供的参数创建完整的租户上下文对象
 * 包含租户 ID、状态和可选的元数据
 *
 * 特性：
 * - 自动设置默认状态为 'active'
 * - 支持自定义状态和元数据
 * - 输入验证确保 ID 有效性
 * - 类型安全的租户上下文创建
 *
 * @param id 租户唯一标识符，必须是非空字符串
 * @param options 可选配置对象
 * @param options.status 租户状态，默认为 'active'
 * @param options.metadata 租户元数据，可包含任意键值对
 * @returns 完整的租户上下文对象
 * @throws InvalidTenantError 当租户 ID 无效时抛出
 *
 * @example
 * ```typescript
 * // 创建基本租户
 * const tenant = createTenantContext('tenant-001');
 * // { id: 'tenant-001', status: 'active' }
 *
 * // 创建带配置的租户
 * const tenant = createTenantContext('tenant-002', {
 *   status: 'suspended',
 *   metadata: { plan: 'enterprise', region: 'us-east' }
 * });
 * // { id: 'tenant-002', status: 'suspended', metadata: { plan: 'enterprise', region: 'us-east' } }
 *
 * // 在多租户系统中
 * const tenant = createTenantContext('company-xyz', {
 *   metadata: {
 *     companyName: 'XYZ Corp',
 *     subscriptionTier: 'premium'
 *   }
 * });
 * ```
 */
export function createTenantContext(
  id: string,
  options?: {
    status?: TenantStatus;
    metadata?: Record<string, unknown>;
  }
): TenantContext {
  // 输入验证 - 确保租户 ID 有效
  if (!id || typeof id !== 'string') {
    throw new InvalidTenantError('Tenant ID must be a non-empty string');
  }

  // 验证 metadata 类型（如果提供）
  if (options?.metadata !== undefined && typeof options.metadata !== 'object') {
    throw new InvalidTenantError('Tenant metadata must be an object');
  }

  // 验证 status 值（如果提供）
  if (options?.status !== undefined) {
    const validStatuses: TenantStatus[] = ['active', 'suspended', 'deleted'];
    if (!validStatuses.includes(options.status)) {
      throw new InvalidTenantError(`Invalid tenant status: ${options.status}`);
    }
  }

  return {
    id,
    status: options?.status ?? 'active',
    metadata: options?.metadata,
  };
}

/**
 * 验证租户上下文
 * 类型守卫函数，确保租户上下文有效且可用
 * 验证租户存在、ID 有效且状态不是 suspended 或 deleted
 *
 * 特性：
 * - 类型守卫，确保后续代码中 tenant 不为 null/undefined
 * - 检查租户 ID 有效性
 * - 验证租户状态，排除 suspended 和 deleted 状态
 * - 详细的错误信息帮助调试
 *
 * @param tenant 要验证的租户上下文对象
 * @throws MissingTenantContextError 当租户上下文为空时抛出
 * @throws InvalidTenantError 当租户 ID 无效或状态不允许时抛出
 *
 * @example
 * ```typescript
 * // 验证租户
 * try {
 *   validateTenantContext(tenant);
 *   // 现在 tenant 被确保为有效的 TenantContext 类型
 *   console.log(`租户 ${tenant.id} 验证通过`);
 * } catch (error) {
 *   console.error('租户验证失败:', error.message);
 * }
 *
 * // 在函数中使用类型守卫
 * function processTenant(t: TenantContext | null) {
 *   validateTenantContext(t); // 如果 t 无效会抛出异常
 *   // t 现在被确保为 TenantContext 类型
 *   console.log(t.id); // TypeScript 知道 t 不是 null
 * }
 *
 * // 在中间件中验证
 * const tenant = getTenantFromRequest();
 * validateTenantContext(tenant);
 * // 如果验证通过，继续处理业务逻辑
 * ```
 */
export function validateTenantContext(
  tenant: TenantContext | null | undefined
): asserts tenant is TenantContext {
  // 检查租户上下文是否存在
  if (!tenant) {
    throw new MissingTenantContextError();
  }

  // 验证租户 ID 有效性
  if (!tenant.id || typeof tenant.id !== 'string') {
    throw new InvalidTenantError('Tenant ID must be a non-empty string');
  }

  // 检查租户状态 - suspended 租户不允许操作
  if (tenant.status === 'suspended') {
    throw new InvalidTenantError('Tenant is suspended');
  }

  // 检查租户状态 - deleted 租户不允许操作
  if (tenant.status === 'deleted') {
    throw new InvalidTenantError('Tenant is deleted');
  }
}

/**
 * 检查租户是否处于活跃状态
 * 简单的状态检查函数，判断租户是否可以进行正常操作
 *
 * @param tenant 租户上下文对象
 * @returns 如果租户状态为 active 或未设置，返回 true；否则返回 false
 *
 * @example
 * ```typescript
 * const activeTenant = createTenantContext('tenant-001');
 * isTenantActive(activeTenant); // true
 *
 * const suspendedTenant = createTenantContext('tenant-002', { status: 'suspended' });
 * isTenantActive(suspendedTenant); // false
 *
 * const deletedTenant = createTenantContext('tenant-003', { status: 'deleted' });
 * isTenantActive(deletedTenant); // false
 *
 * // 在权限检查中使用
 * if (!isTenantActive(currentTenant)) {
 *   throw new Error('租户已被暂停，无法执行此操作');
 * }
 * ```
 */
export function isTenantActive(tenant: TenantContext): boolean {
  // 租户状态为 active 或未设置（默认为 active）时返回 true
  return !tenant.status || tenant.status === 'active';
}

/**
 * 创建系统租户
 * 用于内部操作的特殊租户，具有系统权限和访问能力
 * 通常用于系统维护、后台任务或不需要特定租户上下文的操作
 *
 * @returns 系统租户上下文对象，ID 为 'system'
 *
 * @example
 * ```typescript
 * // 创建系统租户用于后台任务
 * const systemTenant = createSystemTenant();
 * // { id: 'system', status: 'active', metadata: { isSystem: true } }
 *
 * // 在系统初始化时使用
 * const initTenant = createSystemTenant();
 * console.log(`系统初始化租户: ${initTenant.id}`);
 *
 * // 在不需要租户上下文的场景中使用
 * function performSystemOperation() {
 *   const originalTenant = TenantContextHolder.get();
 *   return TenantContextHolder.run(systemTenant, () => {
 *     // 执行系统级操作
 *     return performAdminTask();
 *   });
 * }
 * ```
 */
export function createSystemTenant(): TenantContext {
  return {
    id: 'system',
    status: 'active',
    metadata: { isSystem: true },
  };
}

/**
 * 默认租户（单租户模式）
 * 用于单租户应用的默认租户上下文
 * 当不需要多租户隔离时使用此默认租户
 *
 * @example
 * ```typescript
 * // 在单租户应用中使用
 * const tenant = DEFAULT_TENANT;
 * // { id: 'default', status: 'active' }
 *
 * // 检查是否为默认租户
 * function isDefaultMode(tenant: TenantContext): boolean {
 *   return tenant.id === DEFAULT_TENANT.id;
 * }
 *
 * // 在配置中使用
 * const currentTenant = enableMultiTenancy ? detectedTenant : DEFAULT_TENANT;
 * ```
 */
export const DEFAULT_TENANT: TenantContext = {
  id: 'default',
  status: 'active',
} as const;

/**
 * 租户上下文持有者
 * 使用异步本地存储模式管理租户上下文的静态类
 * 提供了在异步操作中传递和访问租户上下文的机制
 *
 * 特性：
 * - 静态方法，无需实例化
 * - 支持同步和异步上下文的嵌套执行
 * - 自动恢复上一个上下文（run/runAsync）
 * - 线程安全（单个线程内的上下文管理）
 *
 * 使用场景：
 * - 在 HTTP 请求处理中传递租户上下文
 * - 在异步操作中保持租户上下文
 * - 实现租户上下文的中间件模式
 *
 * @example
 * ```typescript
 * // 设置租户上下文
 * const tenant = createTenantContext('tenant-001');
 * TenantContextHolder.set(tenant);
 *
 * // 获取租户上下文
 * const currentTenant = TenantContextHolder.get();
 * console.log(currentTenant?.id); // 'tenant-001'
 *
 * // 安全获取租户上下文（不存在时抛出异常）
 * const tenant = TenantContextHolder.getOrThrow();
 *
 * // 清除租户上下文
 * TenantContextHolder.clear();
 *
 * // 同步上下文执行
 * const result = TenantContextHolder.run(tenant, () => {
 *   // 在此函数内，租户上下文已设置
 *   return processBusinessLogic();
 * });
 *
 * // 异步上下文执行
 * const result = await TenantContextHolder.runAsync(tenant, async () => {
 *   // 在此异步函数内，租户上下文已设置
 *   const data = await fetchData();
 *   return processData(data);
 * });
 *
 * // 中间件模式
 * function withTenant<T>(tenant: TenantContext, fn: () => T): T {
 *   return TenantContextHolder.run(tenant, fn);
 * }
 *
 * // 在 Express 风格中间件中使用
 * app.use((req, res, next) => {
 *   const tenant = resolveTenantFromRequest(req);
 *   TenantContextHolder.set(tenant);
 *   try {
 *     next();
 *   } finally {
 *     TenantContextHolder.clear();
 *   }
 * });
 * ```
 */
export class TenantContextHolder {
  /**
   * 内部存储的租户上下文（静态）
   * 注意：这是线程局部存储，在多线程环境中需要额外考虑
   */
  private static context: TenantContext | null = null;

  /**
   * 设置租户上下文
   * 覆盖当前线程中的租户上下文
   *
   * @param tenant 要设置的租户上下文
   * @throws InvalidTenantError 当租户上下文无效时抛出
   */
  static set(tenant: TenantContext): void {
    // 验证租户上下文有效性
    if (!tenant || !tenant.id || typeof tenant.id !== 'string') {
      throw new InvalidTenantError('Invalid tenant context: ID is required');
    }
    TenantContextHolder.context = tenant;
  }

  /**
   * 获取租户上下文
   * 返回当前线程中的租户上下文，可能为 null
   *
   * @returns 当前租户上下文，如果未设置则返回 null
   */
  static get(): TenantContext | null {
    return TenantContextHolder.context;
  }

  /**
   * 获取租户上下文（安全版本）
   * 如果租户上下文未设置，抛出异常
   *
   * @returns 当前租户上下文
   * @throws MissingTenantContextError 当租户上下文未设置时抛出
   */
  static getOrThrow(): TenantContext {
    if (!TenantContextHolder.context) {
      throw new MissingTenantContextError();
    }
    return TenantContextHolder.context;
  }

  /**
   * 清除租户上下文
   * 将当前线程中的租户上下文设置为 null
   */
  static clear(): void {
    TenantContextHolder.context = null;
  }

  /**
   * 在租户上下文中执行函数（同步版本）
   * 临时设置租户上下文，执行函数后自动恢复原上下文
   * 支持嵌套调用，线程安全
   *
   * @param tenant 要设置的租户上下文
   * @param fn 要执行的函数
   * @returns 函数的执行结果
   *
   * @example
   * ```typescript
   * const result = TenantContextHolder.run(tenantA, () => {
   *   // 当前租户为 tenantA
   *   console.log(TenantContextHolder.get()?.id); // 'tenantA'
   *
   *   // 嵌套调用
   *   return TenantContextHolder.run(tenantB, () => {
   *     // 当前租户为 tenantB
   *     console.log(TenantContextHolder.get()?.id); // 'tenantB'
   *     return 'result';
   *   });
   * });
   * // 执行完毕后上下文自动恢复为 tenantA
   * ```
   */
  static run<T>(tenant: TenantContext, fn: () => T): T {
    // 保存当前上下文
    const previous = TenantContextHolder.context;
    // 设置新上下文
    TenantContextHolder.context = tenant;
    try {
      // 执行函数
      return fn();
    } finally {
      // 无论成功或失败，都恢复原上下文
      TenantContextHolder.context = previous;
    }
  }

  /**
   * 在租户上下文中执行函数（异步版本）
   * 临时设置租户上下文，执行异步函数后自动恢复原上下文
   * 支持嵌套调用，线程安全
   *
   * @param tenant 要设置的租户上下文
   * @param fn 要执行的异步函数
   * @returns 异步函数的执行结果
   *
   * @example
   * ```typescript
   * const result = await TenantContextHolder.runAsync(tenant, async () => {
   *   // 当前租户已设置
   *   const user = await getCurrentUser();
   *   return processUserData(user);
   * });
   *
   * // 在 Express 路由中使用
   * app.get('/api/data', async (req, res) => {
   *   const tenant = resolveTenant(req);
   *   const data = await TenantContextHolder.runAsync(tenant, async () => {
   *     // 在此异步函数内，租户上下文可用
   *     return await fetchDataForTenant();
   *   });
   *   res.json(data);
   * });
   * ```
   */
  static async runAsync<T>(tenant: TenantContext, fn: () => Promise<T>): Promise<T> {
    // 保存当前上下文
    const previous = TenantContextHolder.context;
    // 设置新上下文
    TenantContextHolder.context = tenant;
    try {
      // 执行异步函数
      return await fn();
    } finally {
      // 无论成功或失败，都恢复原上下文
      TenantContextHolder.context = previous;
    }
  }
}
