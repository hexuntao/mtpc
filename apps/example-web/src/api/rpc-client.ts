/**
 * Hono RPC 类型安全客户端
 *
 * 使用 Hono 的 hc 函数创建 API 客户端
 *
 * 注意：由于 monorepo 类型导出复杂性，目前使用 any 类型
 * 实际使用中类型推导正常工作（在独立项目中）
 *
 * @example
 * ```typescript
 * import { rpc, createAuthClient } from './api/rpc-client';
 *
 * // 基本用法
 * const result = await rpc.api.products.$get();
 * const data = await result.json();
 * ```
 */

import { hc } from 'hono/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppType = any;

// 创建 RPC 客户端
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rpc = hc<any>('http://localhost:3000', {
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 创建带认证和租户上下文的客户端
 */
export function createAuthClient(userId: string, tenantId = 'default') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return hc<any>('http://localhost:3000', {
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
    },
  });
}
