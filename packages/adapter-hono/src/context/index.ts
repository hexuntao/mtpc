/**
 * 上下文管理模块
 *
 * 提供 Hono 上下文与 MTPC 上下文之间的桥接功能
 *
 * **主要功能**：
 * - 从 Hono 上下文中获取租户、主体、MTPC 上下文
 * - 设置租户、主体信息到 Hono 上下文
 * - 从 Hono 请求中提取信息创建 MTPC 上下文
 *
 * @module context
 */

export * from './mtpc-context.js';
