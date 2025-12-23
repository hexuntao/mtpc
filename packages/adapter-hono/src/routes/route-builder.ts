import type { MTPCContext, ResourceDefinition } from '@mtpc/core';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { ApiResponse, MTPCEnv } from '../types.js';

/**
 * 路由定义结构
 * 用于存储路由的元信息
 */
interface RouteDefinition {
  /** 路由名称（用于标识） */
  name: string;
  /** HTTP 方法 */
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** 路由路径 */
  path: string;
  /** 路由处理函数 */
  handler: (c: Context<MTPCEnv>, ctx: MTPCContext) => Promise<unknown>;
  /** 所需权限（null 表示无需权限检查） */
  permission: string | null;
}

/**
 * 动作配置选项
 */
interface ActionOptions {
  /** 权限码（默认使用 resourceName:actionName 格式） */
  permission?: string;
  /** 路由路径（默认使用 /:actionName 格式） */
  path?: string;
}

/**
 * 路由构建器类
 * 提供流式 API 来构建自定义路由
 *
 * **特点**：
 * - 链式调用，易于使用
 * - 自动添加权限检查中间件
 * - 支持自定义 HTTP 方法和路径
 * - 统一的响应格式处理
 *
 * @example
 * ```typescript
 * const builder = new RouteBuilder(userResource);
 *
 * builder
 *   .use(rateLimitMiddleware())
 *   .get('/', listUsers)
 *   .post('/', createUser, 'user:create')
 *   .get('/:id', getUser, 'user:read')
 *   .put('/:id', updateUser, 'user:update')
 *   .delete('/:id', deleteUser, 'user:delete')
 *   .build();
 * ```
 */
export class RouteBuilder {
  /** 资源定义对象 */
  private resource: ResourceDefinition;

  /** Hono 应用实例 */
  private app: Hono<MTPCEnv>;

  /** 全局中间件列表 */
  private middlewares: MiddlewareHandler<MTPCEnv>[] = [];

  /** 路由定义列表 */
  private routes: RouteDefinition[] = [];

  constructor(resource: ResourceDefinition) {
    this.resource = resource;
    this.app = new Hono<MTPCEnv>();
  }

  /**
   * 添加全局中间件
   * 中间件会应用到所有路由
   *
   * @param middleware - Hono 中间件
   * @returns this，支持链式调用
   */
  use(middleware: MiddlewareHandler<MTPCEnv>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 添加自定义动作路由
   *
   * @param name - 动作名称
   * @param method - HTTP 方法
   * @param handler - 路由处理函数
   * @param options - 配置选项
   * @returns this，支持链式调用
   *
   * @example
   * ```typescript
   * builder.action('publish', 'post', async (c, ctx) => {
   *   await publishDocument(c.req.param('id'));
   *   return c.json({ success: true });
   * }, { path: '/:id/publish', permission: 'document:publish' });
   * ```
   */
  action(
    name: string,
    method: RouteDefinition['method'],
    handler: RouteDefinition['handler'],
    options: ActionOptions = {}
  ): this {
    // 默认路径格式：/:actionName
    const { permission, path = `/:${name}` } = options;

    this.routes.push({
      name,
      method,
      path,
      handler,
      // 默认权限格式：resourceName:actionName
      permission: permission ?? `${this.resource.name}:${name}`,
    });

    return this;
  }

  /**
   * 添加 GET 路由
   *
   * @param path - 路由路径
   * @param handler - 路由处理函数
   * @param permission - 权限码（可选）
   * @returns this，支持链式调用
   */
  get(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'get', handler, { path, permission });
  }

  /**
   * 添加 POST 路由
   *
   * @param path - 路由路径
   * @param handler - 路由处理函数
   * @param permission - 权限码（可选）
   * @returns this，支持链式调用
   */
  post(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'post', handler, { path, permission });
  }

  /**
   * 添加 PUT 路由
   *
   * @param path - 路由路径
   * @param handler - 路由处理函数
   * @param permission - 权限码（可选）
   * @returns this，支持链式调用
   */
  put(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'put', handler, { path, permission });
  }

  /**
   * 添加 DELETE 路由
   *
   * @param path - 路由路径
   * @param handler - 路由处理函数
   * @param permission - 权限码（可选）
   * @returns this，支持链式调用
   */
  delete(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'delete', handler, { path, permission });
  }

  /**
   * 构建并返回 Hono 应用实例
   *
   * **处理流程**：
   * 1. 应用所有全局中间件
   * 2. 遍历所有路由定义
   * 3. 为每个路由添加权限检查（如果需要）
   * 4. 包装处理函数，统一响应格式
   * 5. 注册路由到 Hono 应用
   *
   * @returns Hono 应用实例
   */
  build(): Hono<MTPCEnv> {
    // 步骤1：应用全局中间件
    for (const mw of this.middlewares) {
      this.app.use('*', mw);
    }

    // 步骤2：注册所有路由
    for (const route of this.routes) {
      // 构建中间件链：权限检查（可选）+ 路由处理
      const handlers: MiddlewareHandler<MTPCEnv>[] = [];

      // 如果需要权限，添加权限检查中间件
      if (route.permission) {
        handlers.push(requirePermission(route.permission));
      }

      // 路由处理函数
      // 包装原始处理函数，提供统一的响应格式处理
      const routeHandler = async (c: Context<MTPCEnv>): Promise<Response> => {
        const ctx = getMTPCContext(c);
        const result = await route.handler(c, ctx);

        // 如果处理函数已经返回 Response，直接返回
        // 这允许自定义响应（如文件下载、重定向等）
        if (result instanceof Response) {
          return result;
        }

        // 否则，包装为标准 API 响应格式
        return c.json({ success: true, data: result } satisfies ApiResponse);
      };

      handlers.push(routeHandler);

      // 根据 HTTP 方法注册路由
      switch (route.method) {
        case 'get':
          this.app.get(route.path, ...handlers);
          break;
        case 'post':
          this.app.post(route.path, ...handlers);
          break;
        case 'put':
          this.app.put(route.path, ...handlers);
          break;
        case 'delete':
          this.app.delete(route.path, ...handlers);
          break;
        case 'patch':
          this.app.patch(route.path, ...handlers);
          break;
      }
    }

    return this.app;
  }
}

/**
 * 创建路由构建器
 *
 * @param resource - 资源定义对象
 * @returns 路由构建器实例
 *
 * @example
 * ```typescript
 * const builder = createRouteBuilder(userResource);
 *
 * const routes = builder
 *   .use(rateLimitMiddleware())
 *   .get('/', listUsers)
 *   .post('/', createUser, 'user:create')
 *   .get('/:id', getUser)
 *   .put('/:id', updateUser)
 *   .delete('/:id', deleteUser)
 *   .build();
 *
 * app.route('/users', routes);
 * ```
 */
export function createRouteBuilder(resource: ResourceDefinition): RouteBuilder {
  return new RouteBuilder(resource);
}
