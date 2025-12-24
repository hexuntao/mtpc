/**
 * 后端 App 类型声明
 *
 * 正确的 Hono RPC 类型定义
 */

import type { Hono } from 'hono';

// ==================== 响应类型 ====================

export interface SuccessResponse<T> {
  success: true;
  data?: T;
}

// ==================== 工具类型 ====================

type TypedEndpoint<Input, Output> = {
  input: Input;
  output: Output;
  outputFormat: 'json';
  status: 200;
};

// ==================== 路由类型定义 ====================

// 注意：Hono RPC 使用完整路径作为 Schema 的键
// 例如 '/api/products' 对应 client.api.products

type ApiEndpoints = {
  '/api/products': {
    $get: TypedEndpoint<
      { query?: { page?: string; pageSize?: string; search?: string } },
      SuccessResponse<Array<{ id: string; name: string; price: number; sku: string }>>
    >;
    $post: TypedEndpoint<
      {
        json: { name: string; price: number; sku: string; description?: string; category?: string };
      },
      SuccessResponse<{ id: string; name: string; price: number; sku: string }>
    >;
  };
  '/api/products/:id': {
    $get: TypedEndpoint<
      { param: { id: string } },
      SuccessResponse<{ id: string; name: string; price: number; sku: string }>
    >;
    $put: TypedEndpoint<
      {
        param: { id: string };
        json: Partial<{ name: string; price: number; description: string; category: string }>;
      },
      SuccessResponse<{ id: string; name: string; price: number; sku: string }>
    >;
    $delete: TypedEndpoint<{ param: { id: string } }, SuccessResponse<null>>;
  };
  '/api/orders': {
    $get: TypedEndpoint<
      { query?: { page?: string; pageSize?: string } },
      SuccessResponse<Array<{ id: string; customerId: string; totalAmount: number }>>
    >;
    $post: TypedEndpoint<
      {
        json: {
          customerId: string;
          items: Array<{ productId: string; quantity: number }>;
          totalAmount: number;
        };
      },
      SuccessResponse<{ id: string; customerId: string; totalAmount: number }>
    >;
  };
  '/api/customers': {
    $get: TypedEndpoint<
      { query?: { page?: string; pageSize?: string } },
      SuccessResponse<Array<{ id: string; email: string; firstName: string; lastName: string }>>
    >;
    $post: TypedEndpoint<
      { json: { email: string; firstName: string; lastName: string } },
      SuccessResponse<{ id: string; email: string; firstName: string; lastName: string }>
    >;
  };
  '/api/roles': {
    $get: TypedEndpoint<
      { query?: { page?: string; pageSize?: string } },
      SuccessResponse<
        Array<{ id: string; name: string; description?: string; permissions: string[] }>
      >
    >;
    $post: TypedEndpoint<
      { json: { name: string; description?: string; permissions: string[] } },
      SuccessResponse<{ id: string; name: string; description?: string; permissions: string[] }>
    >;
  };
  '/api/permissions': {
    $get: TypedEndpoint<{}, SuccessResponse<{ permissions: string[]; roles: string[] }>>;
  };
  '/api/metadata': {
    $get: TypedEndpoint<
      {},
      SuccessResponse<{
        resources: Array<{ name: string; permissions: string[] }>;
        permissions: Array<{ code: string; name: string }>;
      }>
    >;
  };
};

// 导出 Hono 类型
export type AppType = Hono<any, ApiEndpoints, '/'>;
