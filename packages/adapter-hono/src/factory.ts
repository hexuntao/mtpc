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
 * Create complete MTPC Hono app
 */
export function createMTPCApp<T>(mtpc: MTPC, options: MTPCAppOptions = {}): Hono<MTPCEnv> {
  const {
    prefix = '/api',
    cors: corsOptions = {},
    logging = true,
    errorHandling = true,
    tenantOptions = {},
    authOptions = {},
    handlerFactory = createInMemoryHandlerFactory() as <U>(
      resource: ResourceDefinition
    ) => CRUDHandlers<U>,
  } = options;

  const app = new Hono<MTPCEnv>();

  // CORS
  if (corsOptions !== false) {
    app.use('*', cors(corsOptions === true ? {} : (corsOptions as Parameters<typeof cors>[0])));
  }

  // Logging
  if (logging) {
    app.use('*', logger());
  }

  // MTPC core middleware
  app.use('*', mtpcMiddleware(mtpc));

  // Tenant middleware
  app.use(`${prefix}/*`, tenantMiddleware(tenantOptions));

  // Auth middleware
  app.use(`${prefix}/*`, authMiddleware(authOptions));

  // Resource routes
  const resourceRoutes = createRPCRoutes<T>(
    mtpc,
    handlerFactory as (resource: ResourceDefinition) => CRUDHandlers<T>
  );
  app.route(prefix, resourceRoutes);

  // Metadata endpoint
  app.get(`${prefix}/metadata`, c => {
    const metadata = mtpc.exportMetadata();
    return c.json({ success: true, data: metadata } satisfies ApiResponse);
  });

  // Health check
  app.get('/health', c => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mtpc: mtpc.getSummary(),
    });
  });

  // Error handling
  if (errorHandling) {
    app.onError(mtpcErrorHandler());
    app.notFound(notFoundHandler);
  }

  return app;
}

/**
 * Create minimal MTPC Hono app (just middleware, no routes)
 */
export function createMinimalMTPCApp(
  mtpc: MTPC,
  options: Pick<MTPCAppOptions, 'tenantOptions' | 'authOptions'> = {}
): Hono<MTPCEnv> {
  const { tenantOptions = {}, authOptions = {} } = options;

  const app = new Hono<MTPCEnv>();

  // MTPC core middleware
  app.use('*', mtpcMiddleware(mtpc));

  // Tenant middleware
  app.use('*', tenantMiddleware(tenantOptions));

  // Auth middleware
  app.use('*', authMiddleware(authOptions));

  // Error handling
  app.onError(mtpcErrorHandler());

  return app;
}

/**
 * Mount MTPC options
 */
export interface MountMTPCOptions {
  prefix?: string;
  handlerFactory?: <T>(resource: ResourceDefinition) => CRUDHandlers<T>;
  tenantOptions?: MTPCAppOptions['tenantOptions'];
  authOptions?: MTPCAppOptions['authOptions'];
}

/**
 * Mount MTPC routes on existing Hono app
 */
export function mountMTPC<T>(
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

  // Apply middleware to prefix
  app.use(`${prefix}/*`, mtpcMiddleware(mtpc));
  app.use(`${prefix}/*`, tenantMiddleware(tenantOptions));
  app.use(`${prefix}/*`, authMiddleware(authOptions));

  // Mount routes
  const resourceRoutes = createRPCRoutes<T>(
    mtpc,
    handlerFactory as (resource: ResourceDefinition) => CRUDHandlers<T>
  );
  app.route(prefix, resourceRoutes);

  return app;
}
