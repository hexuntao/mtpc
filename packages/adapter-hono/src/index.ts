// @mtpc/adapter-hono - MTPC 的 Hono 框架适配器
// 提供将 MTPC 多租户权限核心集成到 Hono 应用中的完整解决方案

/** 上下文管理模块 */
export * from './context/index.js';

/** 工厂函数模块 - 创建完整的 Hono 应用 */
export * from './factory.js';

/** 中间件模块 - 租户、认证、权限等中间件 */
export * from './middleware/index.js';

/** 路由模块 - CRUD 路由、RPC 路由、路由构建器 */
export * from './routes/index.js';

/** RPC 模块 - 客户端和服务端 */
export * from './rpc/index.js';

/** 类型定义模块 */
export * from './types.js';
