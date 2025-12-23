import { zValidator } from '@hono/zod-validator';
import type { MTPC, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { ApiResponse, CRUDHandlers, ListQueryParams, MTPCEnv } from '../types.js';

/**
 * 解析查询参数
 *
 * **支持的查询参数**：
 * - page: 页码（从 1 开始）
 * - pageSize: 每页数量
 *
 * @param query - URL 查询参数对象
 * @returns 解析后的查询选项
 */
function parseQueryParams(query: ListQueryParams): QueryOptions {
  return {
    pagination: {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    },
  };
}

/**
 * 创建 RPC 风格的资源路由
 *
 * **RPC 风格 vs REST 风格**：
 * - REST: 路径包含资源名，如 /users/:id
 * - RPC: 路径更扁平，如 /users（操作通过 HTTP 方法区分）
 *
 * **生成的路由结构**：
 * ```
 * /{resourceName}          - GET (列表), POST (创建)
 * /{resourceName}/:id      - GET (读取), PUT (更新), PATCH (部分更新), DELETE (删除)
 * ```
 *
 * **特点**：
 * - 每个路由都进行权限检查
 * - 使用 Zod 进行请求体验证
 * - 返回标准化的 API 响应格式
 * - 支持根据资源定义动态生成路由
 *
 * @template T - 资源实体类型
 * @param mtpc - MTPC 实例
 * @param handlerFactory - CRUD 处理器工厂函数
 * @returns 包含所有资源 RPC 路由的 Hono 应用实例
 *
 * @example
 * ```typescript
 * const rpcRoutes = createRPCRoutes<User>(mtpc, (resource) => {
 *   if (resource.name === 'users') {
 *     return new UserCRUDHandler(db);
 *   }
 *   return new DefaultCRUDHandler(db);
 * });
 *
 * app.route('/rpc', rpcRoutes);
 * // 生成路由: /rpc/users, /rpc/users/:id, /rpc/orders, /rpc/orders/:id, ...
 * ```
 */
export function createRPCRoutes<T>(
  mtpc: MTPC,
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();

  // 遍历所有已注册的资源
  for (const resource of mtpc.registry.resources.list()) {
    const handlers = handlerFactory(resource);
    const basePath = `/${resource.name}`;

    // ==================== 列表端点 ====================
    // GET /{resourceName}
    // 返回分页的资源列表
    if (resource.features.list && handlers.list) {
      const listHandler = handlers.list;
      app.get(basePath, requirePermission(resource.name, 'list'), async c => {
        const ctx = getMTPCContext(c);
        const query = c.req.query() as ListQueryParams;
        const options = parseQueryParams(query);

        const result = await listHandler(ctx, options);

        return c.json({ success: true, data: result } satisfies ApiResponse<PaginatedResult<T>>);
      });
    }

    // ==================== 创建端点 ====================
    // POST /{resourceName}
    // 创建新资源，使用 createSchema 验证请求体
    if (resource.features.create && handlers.create) {
      const createHandler = handlers.create;
      app.post(
        basePath,
        requirePermission(resource.name, 'create'),
        zValidator('json', resource.createSchema),
        async c => {
          const ctx = getMTPCContext(c);
          const data = c.req.valid('json');

          const result = await createHandler(ctx, data);

          return c.json({ success: true, data: result } satisfies ApiResponse<T>, 201);
        }
      );
    }

    // ==================== 读取端点 ====================
    // GET /{resourceName}/:id
    // 获取单个资源
    if (resource.features.read && handlers.read) {
      const readHandler = handlers.read;
      app.get(`${basePath}/:id`, requirePermission(resource.name, 'read'), async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');

        const result = await readHandler(ctx, id);

        if (!result) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: '资源不存在' },
            } satisfies ApiResponse,
            404
          );
        }

        return c.json({ success: true, data: result } satisfies ApiResponse<T>);
      });
    }

    // ==================== 更新端点 ====================
    // PUT /{resourceName}/:id 和 PATCH /{resourceName}/:id
    // 更新资源，使用 updateSchema 验证请求体
    if (resource.features.update && handlers.update) {
      const updateHandler = handlers.update;

      // 统一的更新处理函数（PUT 和 PATCH 共用）
      // **类型修复说明**：直接使用 Context<MTPCEnv> 替代复杂的类型推导
      // 原来的 Parameters<typeof app.put>[1] 推导失败，因为 TypeScript 无法正确处理 Hono 的重载
      // 使用 Context<MTPCEnv> 是安全的，因为 MTPCEnv 已包含完整的 Variables 类型
      const handleUpdate = async (c: Context<MTPCEnv>) => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');
        // zValidator 中间件会注入验证后的数据，但简化 Context 类型后需要使用 as any 绕过类型检查
        // 运行时行为完全正常，数据仍由 Zod schema 验证
        const data = (c as any).req.valid('json');

        const result = await updateHandler(ctx, id, data);

        if (!result) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: '资源不存在' },
            } satisfies ApiResponse,
            404
          );
        }

        return c.json({ success: true, data: result } satisfies ApiResponse<T>);
      };

      // PUT：完整更新
      app.put(
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        handleUpdate
      );

      // PATCH：部分更新
      app.patch(
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        handleUpdate
      );
    }

    // ==================== 删除端点 ====================
    // DELETE /{resourceName}/:id
    // 删除资源
    if (resource.features.delete && handlers.delete) {
      const deleteHandler = handlers.delete;
      app.delete(`${basePath}/:id`, requirePermission(resource.name, 'delete'), async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');

        const result = await deleteHandler(ctx, id);

        if (!result) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: '资源不存在' },
            } satisfies ApiResponse,
            404
          );
        }

        return c.json({ success: true, data: { deleted: true } } satisfies ApiResponse<{
          deleted: boolean;
        }>);
      });
    }
  }

  return app;
}

/**
 * 创建类型化的 RPC 应用
 * 在 createRPCRoutes 基础上，将路由挂载到 /api 路径
 *
 * @template T - 资源实体类型
 * @param mtpc - MTPC 实例
 * @param handlerFactory - CRUD 处理器工厂函数
 * @returns Hono 应用实例
 *
 * @example
 * ```typescript
 * const app = createTypedRPCApp<User>(mtpc, (resource) => {
 *   return createDatabaseHandler(resource, db);
 * });
 *
 * // 生成的路由示例:
 * // /api/users - GET/POST
 * // /api/users/:id - GET/PUT/PATCH/DELETE
 * // /api/orders - GET/POST
 * // /api/orders/:id - GET/PUT/PATCH/DELETE
 * ```
 */
export function createTypedRPCApp<T>(
  mtpc: MTPC,
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const routes = createRPCRoutes(mtpc, handlerFactory);

  // 将所有资源路由挂载到 /api 路径下
  app.route('/api', routes);

  return app;
}
