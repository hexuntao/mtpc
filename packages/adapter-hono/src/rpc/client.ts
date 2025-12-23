import type { Hono } from 'hono';
import { hc } from 'hono/client';
import type { ApiResponse, ListQueryParams } from '../types.js';
import type { ClientOptions, MTPCClientOptions, ResourceClientOptions } from './types.js';

/**
 * 处理 fetch 响应，检查 HTTP 状态码并解析 JSON
 *
 * **错误处理**：
 * - 当响应状态码不是 2xx 时抛出错误
 * - 尝试从响应体中解析错误信息
 * - 提供包含状态码和错误消息的详细错误
 *
 * @param response - fetch 响应对象
 * @returns 解析后的 JSON 数据
 * @throws 当 HTTP 状态码表示错误时
 */
async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // 尝试从响应体中解析错误信息
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorData: unknown = null;

    try {
      errorData = await response.json();
      // 尝试从标准错误响应格式中提取消息
      if (errorData && typeof errorData === 'object' && 'error' in errorData) {
        const err = errorData as { error: { message?: string } };
        if (err.error?.message) {
          errorMessage = err.error.message;
        }
      }
    } catch {
      // JSON 解析失败，使用默认错误消息
    }

    throw new Error(errorMessage);
  }

  return response.json() as T;
}

/**
 * 创建类型化的 RPC 客户端
 * 使用 Hono 的 hc 函数创建具有类型安全的客户端
 *
 * @template T - 后端路由类型定义
 * @param baseUrl - API 基础 URL
 * @param options - 客户端配置选项
 * @returns 类型化的 Hono 客户端
 *
 * @example
 * ```typescript
 * // 定义后端路由类型
 * type ApiRoutes = {
 *   users: {
 *     get: (q: { page?: string }) => Promise<ApiResponse<UserList>>;
 *     post: (data: CreateUserInput) => Promise<ApiResponse<User>>;
 *     ':id': {
 *       get: () => Promise<ApiResponse<User>>;
 *       delete: () => Promise<ApiResponse<Deleted>>;
 *     };
 *   };
 * };
 *
 * const client = createRPCClient<ApiRoutes>('https://api.example.com');
 * const users = await client.users.get({ page: '1' });
 * ```
 */
export function createRPCClient<T extends Hono<any, any, any>>(
  baseUrl: string,
  options: ClientOptions = {}
): ReturnType<typeof hc<T>> {
  const { headers = {}, fetch: customFetch } = options;

  return hc<T>(baseUrl, {
    headers,
    fetch: customFetch,
  });
}

/**
 * 资源客户端接口
 * 提供对单个资源的 CRUD 操作访问
 *
 * @template T - 资源实体类型
 */
export interface ResourceClient<T = unknown> {
  /**
   * 分页查询资源列表
   * @param params - 查询参数（分页、排序、过滤）
   * @returns 包含数据数组和总数的响应
   */
  list(params?: ListQueryParams): Promise<ApiResponse<{ data: T[]; total: number }>>;

  /**
   * 创建新资源
   * @param data - 要创建的资源数据
   * @returns 创建后的资源
   */
  create(data: unknown): Promise<ApiResponse<T>>;

  /**
   * 读取单个资源
   * @param id - 资源 ID
   * @returns 资源数据，不存在时返回 null
   */
  read(id: string): Promise<ApiResponse<T | null>>;

  /**
   * 更新资源
   * @param id - 资源 ID
   * @param data - 更新数据
   * @returns 更新后的资源，不存在时返回 null
   */
  update(id: string, data: unknown): Promise<ApiResponse<T | null>>;

  /**
   * 删除资源
   * @param id - 资源 ID
   * @returns 包含删除状态的响应
   */
  delete(id: string): Promise<ApiResponse<{ deleted: boolean }>>;
}

/**
 * 创建资源客户端
 * 提供对单个资源的完整 CRUD 操作访问
 *
 * **特点**：
 * - 自动添加认证头（Token 或 API Key）
 * - 自动添加租户头
 * - 统一的错误处理
 * - 类型安全的 API 调用
 *
 * @template T - 资源实体类型
 * @param baseUrl - API 基础 URL（不含资源名）
 * @param resourceName - 资源名称
 * @param options - 客户端配置选项
 * @returns 资源客户端实例
 *
 * @example
 * ```typescript
 * const userClient = createResourceClient<User>('https://api.example.com', 'users', {
 *   tenantId: 'tenant123',
 *   token: 'jwt-token',
 * });
 *
 * // 查询用户列表
 * const users = await userClient.list({ page: '1', pageSize: '20' });
 *
 * // 创建用户
 * const newUser = await userClient.create({ name: 'John', email: 'john@example.com' });
 *
 * // 读取用户
 * const user = await userClient.read('user-id');
 *
 * // 更新用户
 * const updated = await userClient.update('user-id', { name: 'John Doe' });
 *
 * // 删除用户
 * await userClient.delete('user-id');
 * ```
 */
export function createResourceClient<T = unknown>(
  baseUrl: string,
  resourceName: string,
  options: ResourceClientOptions = {}
): ResourceClient<T> {
  const { tenantId, token, headers = {} } = options;

  // 合并所有请求头
  // 优先级：自定义 headers > token > tenantId
  const allHeaders: Record<string, string> = {
    ...headers,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const resourceUrl = `${baseUrl}/${resourceName}`;

  return {
    async list(params: ListQueryParams = {}): Promise<ApiResponse<{ data: T[]; total: number }>> {
      // 构建查询字符串
      const query = new URLSearchParams();
      if (params.page) query.set('page', params.page);
      if (params.pageSize) query.set('pageSize', params.pageSize);
      if (params.sort) query.set('sort', params.sort);
      if (params.filter) query.set('filter', params.filter);

      const response = await fetch(`${resourceUrl}?${query}`, {
        headers: allHeaders,
      });
      return parseResponse<ApiResponse<{ data: T[]; total: number }>>(response);
    },

    async create(data: unknown): Promise<ApiResponse<T>> {
      const response = await fetch(resourceUrl, {
        method: 'POST',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return parseResponse<ApiResponse<T>>(response);
    },

    async read(id: string): Promise<ApiResponse<T | null>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        headers: allHeaders,
      });
      return parseResponse<ApiResponse<T | null>>(response);
    },

    async update(id: string, data: unknown): Promise<ApiResponse<T | null>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        method: 'PUT',
        headers: {
          ...allHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return parseResponse<ApiResponse<T | null>>(response);
    },

    async delete(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
      const response = await fetch(`${resourceUrl}/${id}`, {
        method: 'DELETE',
        headers: allHeaders,
      });
      return parseResponse<ApiResponse<{ deleted: boolean }>>(response);
    },
  };
}

/**
 * MTPC 客户端类型
 * 提供对所有已注册资源的访问
 *
 * **类型修复说明**：使用交叉类型解决索引签名与方法的冲突
 * - Record<string, ResourceClient> 提供资源客户端的索引访问
 * - 交叉类型允许添加 setTenant/setToken 方法
 *
 * 使用 interface 会导致方法无法兼容索引签名类型
 */
export type MTPCClient = Record<string, ResourceClient> & {
  /** 设置租户 ID（返回新的客户端实例） */
  setTenant(newTenantId: string): MTPCClient;

  /** 设置认证 Token（返回新的客户端实例） */
  setToken(newToken: string): MTPCClient;
};

/**
 * 创建 MTPC 客户端
 * 提供对所有资源的统一访问入口
 *
 * **设计理念**：
 * - 不可变设计：setTenant/setToken 返回新实例
 * - 类型安全：每个资源都有对应的客户端
 * - 自动配置：统一管理认证和租户信息
 *
 * @param baseUrl - API 基础 URL
 * @param options - 客户端配置选项
 * @returns MTPC 客户端实例
 *
 * @example
 * ```typescript
 * const client = createMTPCClient('https://api.example.com', {
 *   resources: ['users', 'orders', 'products'],
 *   tenantId: 'tenant123',
 *   token: 'jwt-token'
 * });
 *
 * // 使用资源客户端
 * const users = await client.users.list();
 * const user = await client.users.read('user-id');
 * const orders = await client.orders.list({ page: '1' });
 *
 * // 切换租户（返回新客户端）
 * const tenantClient = client.setTenant('another-tenant');
 *
 * // 切换 Token（返回新客户端）
 * const authClient = client.setToken('new-token');
 * ```
 */
export function createMTPCClient(baseUrl: string, options: MTPCClientOptions = {}): MTPCClient {
  const { resources = [], tenantId, token } = options;

  // 为每个资源创建客户端
  const clients: Record<string, ResourceClient> = {};

  for (const resourceName of resources) {
    clients[resourceName] = createResourceClient(baseUrl, resourceName, {
      tenantId,
      token,
    });
  }

  return {
    // 展开所有资源客户端
    ...clients,

    // 设置新租户：返回新的客户端实例
    setTenant(newTenantId: string): MTPCClient {
      return createMTPCClient(baseUrl, { ...options, tenantId: newTenantId });
    },

    // 设置新 Token：返回新的客户端实例
    setToken(newToken: string): MTPCClient {
      return createMTPCClient(baseUrl, { ...options, token: newToken });
    },
  } as MTPCClient;
}
