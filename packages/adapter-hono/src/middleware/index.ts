/**
 * 中间件模块
 *
 * 提供完整的 Hono 中间件集，用于集成 MTPC 功能
 *
 * **中间件分类**：
 * - 核心：mtpcMiddleware - 注入 MTPC 实例
 * - 租户：tenantMiddleware, tenantFromPathMiddleware, tenantFromSubdomainMiddleware
 * - 认证：authMiddleware, bearerAuthMiddleware, apiKeyAuthMiddleware
 * - 权限：requirePermission, requireAnyPermission, requireAllPermissions, requireResourcePermission
 * - 错误：mtpcErrorHandler, notFoundHandler
 *
 * @module middleware
 */

export * from './auth.js';
export * from './error-handler.js';
export * from './mtpc.js';
export * from './permission.js';
export * from './tenant.js';
