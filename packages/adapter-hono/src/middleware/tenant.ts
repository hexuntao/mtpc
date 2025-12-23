import { createTenantContext, validateTenantContext } from '@mtpc/core';
import { MissingTenantContextError } from '@mtpc/shared';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { setTenant } from '../context/mtpc-context.js';
import type { MTPCEnv, TenantMiddlewareOptions } from '../types.js';

/**
 * 租户解析中间件
 * 从请求头中解析租户 ID，并创建租户上下文
 *
 * **工作流程**：
 * 1. 从指定的请求头中获取租户 ID
 * 2. 如果没有租户 ID：
 *    - 如果 required=true，抛出 MissingTenantContextError（符合 Architecture.md）
 *    - 如果 required=false，跳过（允许公开 API）
 * 3. 创建租户上下文并验证
 * 4. 将租户上下文存储到 Hono 上下文中
 *
 * @param options - 中间件配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 多租户 API：必须提供租户
 * app.use('/api/*', tenantMiddleware());
 *
 * // 公开 API：不需要租户
 * app.use('/api/public/*', tenantMiddleware({ required: false }));
 *
 * // 自定义配置
 * app.use('/api/*', tenantMiddleware({
 *   headerName: 'x-tenant-id',
 *   required: true,
 *   validate: async (tenant) => {
 *     const exists = await checkTenantExists(tenant.id);
 *     return exists;
 *   }
 * }));
 * ```
 */
export function tenantMiddleware(
  options: TenantMiddlewareOptions = {}
): MiddlewareHandler<MTPCEnv> {
  const { headerName = 'x-tenant-id', required = true, defaultTenantId, validate } = options;

  // ==========================================================================
  // ⚠️ DEPRECATION WARNING
  // ==========================================================================
  // defaultTenantId 选项已废弃，将在下一个主版本中移除
  // 原因：违背 Architecture.md 中 "Tenant Context 不可缺失" 的原则
  // 迁移：使用 required=false 替代
  if (defaultTenantId !== undefined) {
    console.warn(
      '[MTPC Deprecation Warning] defaultTenantId is deprecated and will be removed. ' +
      'Use required: false instead. ' +
      'See: https://github.com/mtpc/mtpc/blob/main/docs/architecture.md#tenant-context'
    );
  }
  // ==========================================================================

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 尝试从请求头中获取租户 ID
    // 支持原始大小写和全小写两种格式
    const tenantId = c.req.header(headerName) ?? c.req.header(headerName.toLowerCase());

    if (!tenantId) {
      // 没有租户 ID 时的处理逻辑
      // 按照 Architecture.md 原则：Tenant Context 不可缺失

      // 如果配置了 defaultTenantId（废弃选项），使用默认值
      // 注意：此行为仅用于向后兼容，将在后续版本中移除
      if (defaultTenantId) {
        const tenant = createTenantContext(defaultTenantId);
        setTenant(c, tenant);
        return next();
      }

      // 如果租户是必填的，抛出错误
      // 这是符合 Architecture.md 的标准行为
      if (required) {
        throw new MissingTenantContextError();
      }

      // 如果租户不是必填的，跳过（允许公开 API 访问）
      return next();
    }

    // 创建租户上下文
    const tenant = createTenantContext(tenantId);

    // 如果提供了验证函数，验证租户有效性
    // 可用于检查租户是否存在、是否被禁用等
    if (validate) {
      const isValid = await validate(tenant);
      if (!isValid) {
        // 租户验证失败，抛出错误
        throw new MissingTenantContextError();
      }
    }

    // 验证租户上下文的有效性
    // 这会检查租户 ID 格式等基本约束
    validateTenantContext(tenant);

    // 将租户上下文设置到 Hono 上下文中
    // 这会自动更新 MTPC 上下文
    setTenant(c, tenant);

    await next();
  });
}

/**
 * 从路径参数中解析租户的中间件
 * 适用于多租户通过路径区分的场景（如 /:tenantId/api/...）
 *
 * @param options - 中间件配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 路由格式: /:tenantId/users
 * app.use('/api/:tenantId/*', tenantFromPathMiddleware({
 *   paramName: 'tenantId',
 *   required: true
 * }));
 * ```
 */
export function tenantFromPathMiddleware(
  options: { paramName?: string; required?: boolean } = {}
): MiddlewareHandler<MTPCEnv> {
  const { paramName = 'tenantId', required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 从路径参数中获取租户 ID
    const tenantId = c.req.param(paramName);

    if (!tenantId) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    // 创建并验证租户上下文
    const tenant = createTenantContext(tenantId);
    validateTenantContext(tenant);
    setTenant(c, tenant);

    await next();
  });
}

/**
 * 从子域名中解析租户的中间件
 * 适用于多租户通过子域名区分的场景（如 tenant.example.com）
 *
 * **解析逻辑**：
 * 1. 从 Host 请求头中获取完整主机名
 * 2. 检查主机名是否以 baseDomain 结尾
 * 3. 提取子域名部分作为租户 ID
 *
 * @param options - 中间件配置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * // 假设基础域名是 example.com
 * // tenant1.example.com -> tenantId = "tenant1"
 * // tenant2.example.com -> tenantId = "tenant2"
 * app.use('*', tenantFromSubdomainMiddleware({
 *   baseDomain: 'example.com',
 *   required: true
 * }));
 * ```
 */
export function tenantFromSubdomainMiddleware(options: {
  /** 基础域名，不包含子域名 */
  baseDomain: string;
  /** 是否必须提供租户 */
  required?: boolean;
}): MiddlewareHandler<MTPCEnv> {
  const { baseDomain, required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 获取 Host 请求头
    const host = c.req.header('host') ?? '';

    // 检查主机名是否以基础域名结尾
    if (!baseDomain || !host.endsWith(baseDomain)) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    // 提取子域名部分
    // 例如: "tenant1.example.com" -> "tenant1"
    const subdomain = host.slice(0, -(baseDomain.length + 1));

    // 验证子域名格式
    // 子域名不应为空，也不应包含额外的点号（不支持多级子域名）
    if (!subdomain || subdomain.includes('.')) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    // 创建并验证租户上下文
    const tenant = createTenantContext(subdomain);
    validateTenantContext(tenant);
    setTenant(c, tenant);

    await next();
  });
}
