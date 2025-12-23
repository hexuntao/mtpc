import { zValidator } from '@hono/zod-validator';
import type { PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';
import type {
  ApiResponse,
  CRUDHandlers,
  ListQueryParams,
  MTPCEnv,
  ResourceRouteOptions,
} from '../types.js';

/**
 * API 错误消息常量
 * 统一管理错误消息，方便国际化
 */
const ERROR_MESSAGES = {
  /** 资源不存在 */
  NOT_FOUND: '资源不存在',
} as const;

/**
 * 解析查询参数为查询选项
 *
 * **支持的查询参数**：
 * - page: 页码（从 1 开始）
 * - pageSize: 每页数量
 * - sort: 排序字段
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
    sort: query.sort ? [{ field: query.sort, direction: 'asc' }] : [],
    filters: [], // 过滤器解析由具体实现决定
  };
}

/**
 * 为单个资源创建完整的 CRUD 路由
 *
 * **生成的路由**：
 * - GET    /{prefix}      - 分页列表
 * - POST   /{prefix}      - 创建资源
 * - GET    /{prefix}/:id  - 获取单个资源
 * - PUT    /{prefix}/:id  - 更新资源（完整更新）
 * - PATCH  /{prefix}/:id  - 更新资源（部分更新）
 * - DELETE /{prefix}/:id  - 删除资源
 *
 * **特点**：
 * - 每个路由都会进行权限检查
 * - 使用 Zod 进行请求体验证
 * - 返回标准化的 API 响应格式
 * - 支持 CRUD 处理器的可选实现
 *
 * @template T - 资源实体类型
 * @param resource - 资源定义对象
 * @param handlers - CRUD 处理器实现
 * @param options - 路由配置选项
 * @returns Hono 应用实例
 *
 * @example
 * ```typescript
 * const userRoutes = createResourceRoutes<User>(userResource, userHandlers, {
 *   prefix: '/users',
 *   middleware: [rateLimitMiddleware()]
 * });
 *
 * app.route('/', userRoutes);
 * ```
 */
export function createResourceRoutes<T>(
  resource: ResourceDefinition,
  handlers: CRUDHandlers<T>,
  options: ResourceRouteOptions = {}
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const { middleware = [] } = options;

  // 应用全局中间件（应用到所有路由）
  for (const mw of middleware) {
    app.use('*', mw);
  }

  const resourceName = resource.name;

  // ==================== 列表路由 ====================
  // GET /{resource}
  // 返回分页的资源列表
  if (resource.features.list && handlers.list) {
    const listHandler = handlers.list;
    app.get('/', requirePermission(resourceName, 'list'), async c => {
      const ctx = getMTPCContext(c);
      const query = c.req.query() as ListQueryParams;
      const queryOptions = parseQueryParams(query);

      const result = await listHandler(ctx, queryOptions);

      return c.json({ success: true, data: result } satisfies ApiResponse<PaginatedResult<T>>);
    });
  }

  // ==================== 创建路由 ====================
  // POST /{resource}
  // 创建新资源，使用 createSchema 验证请求体
  if (resource.features.create && handlers.create) {
    const createHandler = handlers.create;
    app.post(
      '/',
      requirePermission(resourceName, 'create'),
      zValidator('json', resource.createSchema), // 使用 Zod 验证请求体
      async c => {
        const ctx = getMTPCContext(c);
        const data = c.req.valid('json'); // 获取验证后的数据

        const result = await createHandler(ctx, data);

        return c.json({ success: true, data: result } satisfies ApiResponse<T>, 201);
      }
    );
  }

  // ==================== 读取路由 ====================
  // GET /{resource}/:id
  // 获取单个资源
  if (resource.features.read && handlers.read) {
    const readHandler = handlers.read;
    app.get('/:id', requirePermission(resourceName, 'read'), async c => {
      const ctx = getMTPCContext(c);
      const id = c.req.param('id');

      const result = await readHandler(ctx, id);

      if (!result) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND },
          } satisfies ApiResponse,
          404
        );
      }

      return c.json({ success: true, data: result } satisfies ApiResponse<T>);
    });
  }

  // ==================== 更新路由 ====================
  // PUT /{resource}/:id 和 PATCH /{resource}/:id
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
            error: { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND },
          } satisfies ApiResponse,
          404
        );
      }

      return c.json({ success: true, data: result } satisfies ApiResponse<T>);
    };

    // PUT：完整更新（通常需要提供所有字段）
    app.put(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      handleUpdate
    );

    // PATCH：部分更新（只更新提供的字段）
    app.patch(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      handleUpdate
    );
  }

  // ==================== 删除路由 ====================
  // DELETE /{resource}/:id
  // 删除资源
  if (resource.features.delete && handlers.delete) {
    const deleteHandler = handlers.delete;
    app.delete('/:id', requirePermission(resourceName, 'delete'), async c => {
      const ctx = getMTPCContext(c);
      const id = c.req.param('id');

      const result = await deleteHandler(ctx, id);

      if (!result) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: ERROR_MESSAGES.NOT_FOUND },
          } satisfies ApiResponse,
          404
        );
      }

      return c.json({ success: true, data: { deleted: true } } satisfies ApiResponse<{
        deleted: boolean;
      }>);
    });
  }

  return app;
}

/**
 * 为所有已注册的资源创建 CRUD 路由
 *
 * **路由结构**：
 * /{prefix}/{resourceName}/...
 *
 * 例如，prefix = '/api' 时：
 * - GET    /api/users
 * - POST   /api/users
 * - GET    /api/users/:id
 * - ...其他资源类似
 *
 * @template T - 资源实体类型
 * @param mtpc - MTPC 实例（包含资源注册表）
 * @param handlerFactory - CRUD 处理器工厂函数
 * @param options - 路由配置选项
 * @returns 包含所有资源路由的 Hono 应用实例
 *
 * @example
 * ```typescript
 * const routes = createAllResourceRoutes<User>(mtpc, (resource) => {
 *   return createDatabaseHandler(resource, db);
 * }, { prefix: '/api' });
 *
 * app.route('/', routes);
 * ```
 */
export function createAllResourceRoutes<T>(
  mtpc: { registry: { resources: { list: () => ResourceDefinition[] } } },
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>,
  options: { prefix?: string } = {}
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const { prefix = '/api' } = options;

  // 遍历所有已注册的资源
  for (const resource of mtpc.registry.resources.list()) {
    // 为每个资源创建处理器和路由
    const handlers = handlerFactory(resource);
    const routes = createResourceRoutes(resource, handlers);

    // 将路由挂载到 /{prefix}/{resourceName}
    app.route(`${prefix}/${resource.name}`, routes);
  }

  return app;
}
