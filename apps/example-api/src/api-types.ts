/**
 * API 类型定义
 *
 * 此文件定义所有 API 端点的输入输出类型
 * 前端可以直接从 @mtpc/adapter-hono 导入使用
 */

import type { ApiResponse } from '@mtpc/adapter-hono';

/**
 * 产品相关类型
 */
export namespace Products {
  export type ListInput = {
    page?: string;
    pageSize?: string;
    search?: string;
  };

  export type ListOutput = ApiResponse<{
    data: Array<{ id: string; name: string; price: number; sku: string }>;
    total: number;
  }>;

  export type CreateInput = {
    name: string;
    price: number;
    sku: string;
    description?: string;
    category?: string;
  };

  export type CreateOutput = ApiResponse<{
    data: { id: string; name: string; price: number; sku: string };
  }>;

  export type ReadInput = { id: string };

  export type ReadOutput = ApiResponse<{
    data: { id: string; name: string; price: number; sku: string } | null;
  }>;

  export type UpdateInput = {
    id: string;
    data: Partial<{
      name: string;
      price: number;
      description: string;
      category: string;
    }>;
  };

  export type UpdateOutput = ApiResponse<{
    data: { id: string; name: string; price: number; sku: string } | null;
  }>;

  export type DeleteInput = { id: string };

  export type DeleteOutput = ApiResponse<{ deleted: boolean }>;
}

/**
 * 订单相关类型
 */
export namespace Orders {
  export type ListInput = {
    page?: string;
    pageSize?: string;
  };

  export type ListOutput = ApiResponse<{
    data: Array<{ id: string; customerId: string; totalAmount: number }>;
    total: number;
  }>;

  export type CreateInput = {
    customerId: string;
    items: Array<{ productId: string; quantity: number }>;
    totalAmount: number;
  };

  export type CreateOutput = ApiResponse<{
    data: { id: string; customerId: string; totalAmount: number };
  }>;
}

/**
 * 客户相关类型
 */
export namespace Customers {
  export type ListInput = {
    page?: string;
    pageSize?: string;
  };

  export type ListOutput = ApiResponse<{
    data: Array<{ id: string; email: string; firstName: string; lastName: string }>;
    total: number;
  }>;

  export type CreateInput = {
    email: string;
    firstName: string;
    lastName: string;
  };

  export type CreateOutput = ApiResponse<{
    data: { id: string; email: string; firstName: string; lastName: string };
  }>;
}

/**
 * 角色相关类型
 */
export namespace Roles {
  export type ListInput = {
    page?: string;
    pageSize?: string;
  };

  export type ListOutput = ApiResponse<{
    data: Array<{ id: string; name: string; description?: string; permissions: string[] }>;
    total: number;
  }>;

  export type CreateInput = {
    name: string;
    description?: string;
    permissions: string[];
  };

  export type CreateOutput = ApiResponse<{
    data: { id: string; name: string; description?: string; permissions: string[] };
  }>;
}

/**
 * 权限类型
 */
export namespace Permissions {
  export type GetInput = Record<string, never>;

  export type GetOutput = ApiResponse<{
    permissions: string[];
    roles: string[];
  }>;
}

/**
 * 元数据类型
 */
export namespace Metadata {
  export type GetInput = Record<string, never>;

  export type GetOutput = ApiResponse<{
    resources: Array<{ name: string; permissions: string[] }>;
    permissions: Array<{ code: string; name: string }>;
  }>;
}

/**
 * 完整的 API 路由定义
 */
export type ApiRoutes = {
  '/api/products': {
    list: { input: Products.ListInput; output: Products.ListOutput };
    create: { input: Products.CreateInput; output: Products.CreateOutput };
  };
  '/api/products/:id': {
    read: { input: Products.ReadInput; output: Products.ReadOutput };
    update: { input: Products.UpdateInput; output: Products.UpdateOutput };
    delete: { input: Products.DeleteInput; output: Products.DeleteOutput };
  };
  '/api/orders': {
    list: { input: Orders.ListInput; output: Orders.ListOutput };
    create: { input: Orders.CreateInput; output: Orders.CreateOutput };
  };
  '/api/customers': {
    list: { input: Customers.ListInput; output: Customers.ListOutput };
    create: { input: Customers.CreateInput; output: Customers.CreateOutput };
  };
  '/api/roles': {
    list: { input: Roles.ListInput; output: Roles.ListOutput };
    create: { input: Roles.CreateInput; output: Roles.CreateOutput };
  };
  '/api/permissions': {
    get: { input: Permissions.GetInput; output: Permissions.GetOutput };
  };
  '/api/metadata': {
    get: { input: Metadata.GetInput; output: Metadata.GetOutput };
  };
};
