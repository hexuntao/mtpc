import type { InferSchema, PaginatedResult, ResourceDefinition } from '@mtpc/core';

import type { ApiResponse, ListQueryParams } from '../types.js';

/**
 * 从资源定义推断 CRUD 路由的类型
 *
 * **生成的类型结构**：
 * - list: 分页列表查询的输入输出
 * - create: 创建资源的输入输出
 * - read: 读取单个资源的输入输出
 * - update: 更新资源的输入输出
 * - delete: 删除资源的输入输出
 *
 * @template T - 资源定义类型
 *
 * @example
 * ```typescript
 * const userResource = defineResource({
 *   name: 'user',
 *   schema: z.object({ id: z.string(), name: z.string() }),
 *   createSchema: z.object({ name: z.string() }),
 *   updateSchema: z.object({ name: z.string().optional() })
 * });
 *
 * type UserRoutes = InferCRUDRoutes<typeof userResource>;
 * // UserRoutes = {
 * //   list: { input: ListQueryParams, output: ApiResponse<PaginatedResult<User>> }
 * //   create: { input: CreateUserInput, output: ApiResponse<User> }
 * //   read: { input: { id: string }, output: ApiResponse<User | null> }
 * //   ...
 * // }
 * ```
 */
export type InferCRUDRoutes<T extends ResourceDefinition> = {
  /** 列表查询 */
  list: {
    /** 输入：查询参数 */
    input: ListQueryParams;
    /** 输出：分页结果 */
    output: ApiResponse<PaginatedResult<InferSchema<T['schema']>>>;
  };

  /** 创建资源 */
  create: {
    /** 输入：创建数据（从 createSchema 推断） */
    input: InferSchema<T['createSchema']>;
    /** 输出：创建后的资源 */
    output: ApiResponse<InferSchema<T['schema']>>;
  };

  /** 读取单个资源 */
  read: {
    /** 输入：包含 ID 的对象 */
    input: { id: string };
    /** 输出：资源数据或 null */
    output: ApiResponse<InferSchema<T['schema']> | null>;
  };

  /** 更新资源 */
  update: {
    /** 输入：包含 ID 和更新数据的对象 */
    input: { id: string; data: InferSchema<T['updateSchema']> };
    /** 输出：更新后的资源或 null */
    output: ApiResponse<InferSchema<T['schema']> | null>;
  };

  /** 删除资源 */
  delete: {
    /** 输入：包含 ID 的对象 */
    input: { id: string };
    /** 输出：包含删除状态 */
    output: ApiResponse<{ deleted: boolean }>;
  };
};

/**
 * RPC 路由定义
 * 描述单个 RPC 端点的输入输出类型
 *
 * @template TInput - 请求输入类型
 * @template TOutput - 响应输出类型
 */
export interface RPCRouteDef<TInput = unknown, TOutput = unknown> {
  /** 请求输入类型 */
  input: TInput;
  /** 响应输出类型 */
  output: TOutput;
}

/**
 * 从路由定义推断 RPC 客户端类型
 *
 * **生成的客户端类型**：
 * - 每个路由键对应一个函数
 * - 函数签名与路由定义匹配
 *
 * @template TRoutes - 路由定义对象类型
 *
 * @example
 * ```typescript
 * type ApiRoutes = {
 *   getUsers: RPCRouteDef<{ page: number }, PaginatedResult<User>>;
 *   createUser: RPCRouteDef<{ name: string }, User>;
 *   deleteUser: RPCRouteDef<{ id: string }, { deleted: boolean }>;
 * };
 *
 * type ApiClient = InferRPCClient<ApiRoutes>;
 * // ApiClient = {
 * //   getUsers: (input: { page: number }) => Promise<PaginatedResult<User>>;
 * //   createUser: (input: { name: string }) => Promise<User>;
 * //   deleteUser: (input: { id: string }) => Promise<{ deleted: boolean }>;
 * // }
 * ```
 */
export type InferRPCClient<TRoutes extends Record<string, RPCRouteDef>> = {
  [K in keyof TRoutes]: (input: TRoutes[K]['input']) => Promise<TRoutes[K]['output']>;
};

/**
 * 客户端配置选项
 */
export interface ClientOptions {
  /** 默认请求头 */
  headers?: Record<string, string>;

  /** 自定义 fetch 函数（用于 Node.js 环境、测试等） */
  fetch?: typeof fetch;
}

/**
 * 资源客户端配置选项
 */
export interface ResourceClientOptions {
  /** 租户 ID（用于多租户场景） */
  tenantId?: string;

  /** 认证 Token（Bearer Token） */
  token?: string;

  /** 额外的请求头 */
  headers?: Record<string, string>;
}

/**
 * MTPC 客户端配置选项
 * 包含资源客户端配置，并额外支持资源列表配置
 */
export interface MTPCClientOptions extends ResourceClientOptions {
  /** 要创建客户端的资源名称列表 */
  resources?: string[];
}
