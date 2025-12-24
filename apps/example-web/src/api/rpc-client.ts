/**
 * Hono RPC 类型安全客户端
 *
 * 直接从后端 example-api 导入 ApiRoutes 类型
 * 实现真正的类型推导，无需手动重复定义
 */

import { createTypedRPCClient } from '@mtpc/adapter-hono/rpc';
import type { ApiRoutes } from 'example-api/api-types';
import type { ClientOptions } from '@mtpc/adapter-hono/rpc';

// ==================== 客户端创建 ====================

const baseOptions: ClientOptions = {
  headers: {
    'Content-Type': 'application/json',
  },
};

// 创建基础 RPC 客户端
// 类型直接从后端推导，无需手动定义
export const rpc = createTypedRPCClient<ApiRoutes>('http://localhost:3000', baseOptions);

/**
 * 创建带认证和租户上下文的客户端
 */
export function createAuthClient(userId: string, tenantId = 'default') {
  return createTypedRPCClient<ApiRoutes>('http://localhost:3000', {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
    },
  });
}
