import type { MTPC } from '@mtpc/core';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AuthMiddlewareOptions, MTPCEnv, TenantMiddlewareOptions } from '../types.js';

/**
 * MTPC 核心中间件
 * 将 MTPC 实例注入到 Hono 上下文中，使后续中间件和路由可以访问
 *
 * **作用**：
 * - 将 MTPC 实例存储到 Hono 上下文的 `mtpc` 变量中
 * - 是所有其他 MTPC 中间件的前提依赖
 * - 应该最先被注册
 *
 * @param mtpc - MTPC 核心实例
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * import { createRBACPlugin } from '@mtpc/rbac';
 *
 * // 创建 RBAC 插件
 * const rbacPlugin = createRBACPlugin();
 *
 * // 创建 MTPC 实例（必须提供 defaultPermissionResolver）
 * const mtpc = createMTPC({
 *   defaultPermissionResolver: rbacPlugin.state.evaluator.getPermissions.bind(rbacPlugin.state.evaluator)
 * });
 *
 * mtpc.use(rbacPlugin);
 * await mtpc.init();
 *
 * const app = new Hono();
 * // 必须最先注册
 * app.use('*', mtpcMiddleware(mtpc));
 * ```
 */
export function mtpcMiddleware(mtpc: MTPC): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 将 MTPC 实例注入到上下文中
    // 后续中间件和路由可以通过 c.get('mtpc') 访问
    c.set('mtpc', mtpc);
    await next();
  });
}

/**
 * MTPC 设置配置选项
 * 用于一次性配置 MTPC 相关的中间件
 */
export interface SetupMTPCOptions {
  /** MTPC 核心实例 */
  mtpc: MTPC;

  /** 租户中间件配置 */
  tenantOptions?: TenantMiddlewareOptions;

  /** 认证中间件配置 */
  authOptions?: AuthMiddlewareOptions;
}

/**
 * MTPC 综合设置中间件
 * 一次性设置 MTPC 实例、租户和认证中间件
 *
 * **注意**：此中间件目前只注入 MTPC 实例
 * 租户和认证中间件仍需单独配置
 *
 * @param options - MTPC 设置选项
 * @returns Hono 中间件处理函数
 *
 * @example
 * ```typescript
 * app.use('*', setupMTPC({
 *   mtpc: mtpcInstance,
 *   tenantOptions: { headerName: 'x-tenant-id' },
 *   authOptions: { required: true }
 * }));
 *
 * // 租户和认证中间件仍需单独注册
 * app.use('/api/*', tenantMiddleware({ headerName: 'x-tenant-id' }));
 * app.use('/api/*', authMiddleware({ required: true }));
 * ```
 */
export function setupMTPC(options: SetupMTPCOptions): MiddlewareHandler<MTPCEnv> {
  const { mtpc } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // 设置 MTPC 实例到上下文
    c.set('mtpc', mtpc);
    await next();
  });
}
