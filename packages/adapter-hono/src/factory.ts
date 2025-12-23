import type { MTPC, ResourceDefinition } from '@mtpc/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth.js';
import { mtpcErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { mtpcMiddleware } from './middleware/mtpc.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { createInMemoryHandlerFactory } from './routes/crud-handler.js';
import { createRPCRoutes } from './rpc/server.js';
import type { ApiResponse, CRUDHandlers, MTPCAppOptions, MTPCEnv } from './types.js';

/**
 * 创建完整的 MTPC Hono 应用
 * 包含所有中间件、路由、错误处理等功能
 *
 * @template T - 资源实体类型
 * @param mtpc - MTPC 实例
 * @param options - 应用配置选项
 * @returns 配置好的 Hono 应用实例
 *
 * @example
 * ```typescript
 * const app = createMTPCApp<User>(mtpc, {
 *   prefix: '/api',
 *   logging: true,
 *   errorHandling: true,
 *   tenantOptions: { headerName: 'x-tenant-id' },
 *   authOptions: { required: true }
 * });
 * ```
 */
export function createMTPCApp<T = unknown>(
  mtpc: MTPC,
  options: MTPCAppOptions = {}
): Hono<MTPCEnv> {
  const {
    prefix = '/api',
    cors: corsOptions = {},
    logging = true,
    errorHandling = true,
    tenantOptions = {},
    authOptions = {},
    // 使用默认的内存处理器工厂
    handlerFactory = createInMemoryHandlerFactory() as <U>(
      resource: ResourceDefinition
    ) => CRUDHandlers<U>,
  } = options;

  const app = new Hono<MTPCEnv>();

  // 配置 CORS（跨域资源共享）
  if (corsOptions !== false) {
    // corsOptions 为 true 时使用空配置，否则传递用户提供的配置
    app.use('*', cors(corsOptions === true ? {} : (corsOptions as Parameters<typeof cors>[0])));
  }

  // 配置请求日志中间件
  if (logging) {
    app.use('*', logger());
  }

  // MTPC 核心中间件：注入 MTPC 实例到上下文
  app.use('*', mtpcMiddleware(mtpc));

  // 租户解析中间件：从请求中提取租户信息
  app.use(`${prefix}/*`, tenantMiddleware(tenantOptions));

  // 认证中间件：从请求中提取用户信息
  app.use(`${prefix}/*`, authMiddleware(authOptions));

  // 创建并挂载资源路由
  const resourceRoutes = createRPCRoutes<T>(
    mtpc,
    handlerFactory as (resource: ResourceDefinition) => CRUDHandlers<T>
  );
  app.route(prefix, resourceRoutes);

  // 元数据端点：返回所有资源和权限信息
  app.get(`${prefix}/metadata`, c => {
    const metadata = mtpc.exportMetadata();
    return c.json({ success: true, data: metadata } satisfies ApiResponse);
  });

  // 健康检查端点
  app.get('/health', c => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mtpc: mtpc.getSummary(),
    });
  });

  // 配置错误处理
  if (errorHandling) {
    app.onError(mtpcErrorHandler());
    app.notFound(notFoundHandler);
  }

  return app;
}

/**
 * 创建最小化的 MTPC Hono 应用
 * 仅包含中间件，不包含自动路由，适用于需要自定义路由的场景
 *
 * @param mtpc - MTPC 实例
 * @param options - 配置选项（仅包含租户和认证配置）
 * @returns 配置好的 Hono 应用实例
 *
 * @example
 * ```typescript
 * const app = createMinimalMTPCApp(mtpc, {
 *   tenantOptions: { headerName: 'x-tenant-id' },
 *   authOptions: { required: true }
 * });
 *
 * // 手动添加路由
 * app.get('/custom', handler);
 * ```
 */
export function createMinimalMTPCApp(
  mtpc: MTPC,
  options: Pick<MTPCAppOptions, 'tenantOptions' | 'authOptions'> = {}
): Hono<MTPCEnv> {
  const { tenantOptions = {}, authOptions = {} } = options;

  const app = new Hono<MTPCEnv>();

  // MTPC 核心中间件：注入 MTPC 实例到上下文
  app.use('*', mtpcMiddleware(mtpc));

  // 租户解析中间件
  app.use('*', tenantMiddleware(tenantOptions));

  // 认证中间件
  app.use('*', authMiddleware(authOptions));

  // 错误处理
  app.onError(mtpcErrorHandler());

  return app;
}

/**
 * 挂载 MTPC 路由到现有 Hono 应用
 * 用于在已有应用中添加 MTPC 功能
 *
 * @template T - 资源实体类型
 * @param app - 现有的 Hono 应用实例
 * @param mtpc - MTPC 实例
 * @param options - 挂载配置选项
 * @returns 更新后的 Hono 应用实例
 *
 * @example
 * ```typescript
 * const app = new Hono();
 *
 * // 添加自定义路由
 * app.get('/', (c) => c.text('Hello'));
 *
 * // 挂载 MTPC 路由到 /api 路径
 * mountMTPC(app, mtpc, { prefix: '/api' });
 * ```
 */
export function mountMTPC<T = unknown>(
  app: Hono<MTPCEnv>,
  mtpc: MTPC,
  options: MountMTPCOptions = {}
): Hono<MTPCEnv> {
  const {
    prefix = '/api',
    handlerFactory = createInMemoryHandlerFactory() as <U>(
      resource: ResourceDefinition
    ) => CRUDHandlers<U>,
    tenantOptions = {},
    authOptions = {},
  } = options;

  // 在指定路径下应用中间件
  // 注意：中间件只会应用到 prefix 路径下的路由
  app.use(`${prefix}/*`, mtpcMiddleware(mtpc));
  app.use(`${prefix}/*`, tenantMiddleware(tenantOptions));
  app.use(`${prefix}/*`, authMiddleware(authOptions));

  // 创建并挂载资源路由
  const resourceRoutes = createRPCRoutes<T>(
    mtpc,
    handlerFactory as (resource: ResourceDefinition) => CRUDHandlers<T>
  );
  app.route(prefix, resourceRoutes);

  return app;
}

/**
 * 挂载 MTPC 的配置选项
 */
export interface MountMTPCOptions {
  /**
   * API 路由前缀
   * @default '/api'
   */
  prefix?: string;

  /**
   * CRUD 处理器工厂函数
   * 用于为每个资源创建对应的 CRUD 处理器
   */
  handlerFactory?: <T>(resource: ResourceDefinition) => CRUDHandlers<T>;

  /**
   * 租户中间件配置选项
   */
  tenantOptions?: MTPCAppOptions['tenantOptions'];

  /**
   * 认证中间件配置选项
   */
  authOptions?: MTPCAppOptions['authOptions'];
}
