/**
 * 路由模块
 *
 * 提供路由生成和构建功能
 *
 * **导出内容**：
 * - CRUD 处理器：BaseCRUDHandler, InMemoryCRUDHandler, createInMemoryHandlerFactory
 * - 资源路由：createResourceRoutes, createAllResourceRoutes
 * - 路由构建器：RouteBuilder, createRouteBuilder
 *
 * @module routes
 */

export * from './crud-handler.js';
export * from './resource-routes.js';
export * from './route-builder.js';
