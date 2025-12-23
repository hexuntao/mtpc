/**
 * RPC 模块
 *
 * 提供 RPC 风格的服务端路由和类型安全的客户端
 *
 * **服务端**：
 * - createRPCRoutes: 创建 RPC 风格的资源路由
 * - createTypedRPCApp: 创建完整的 RPC 应用
 *
 * **客户端**：
 * - createRPCClient: 创建类型化的 RPC 客户端
 * - createResourceClient: 创建单个资源的客户端
 * - createMTPCClient: 创建完整的 MTPC 客户端
 *
 * **类型工具**：
 * - InferCRUDRoutes: 从资源定义推断路由类型
 * - RPCRouteDef: RPC 路由定义
 * - InferRPCClient: 从路由定义推断客户端类型
 *
 * @module rpc
 */

export * from './client.js';
export * from './server.js';
export * from './types.js';
