import type { MTPC } from '@mtpc/core';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth.js';
import { mtpcErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { mtpcMiddleware } from './middleware/mtpc.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { createInMemoryHandlerFactory } from './routes/crud-handler.js';
import { createRPCRoutes } from './rpc/server.js';

/**
 * Create MTPC Hono app options
 */

/**
 * Create complete MTPC Hono app
 */
export function createMTPCApp(mtpc, options = {}) {
  const {
    prefix = '/api',
    cors: corsOptions = {},
    logging = true,
    errorHandling = true,
    tenantOptions = {},
    authOptions = {},
    handlerFactory = createInMemoryHandlerFactory(),
  } = options;

  const app = new Hono();

  // CORS
  if (corsOptions !== false) {
    app.use('*', cors(corsOptions === true ? {} : corsOptions));
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
  const resourceRoutes = createRPCRoutes(mtpc, handlerFactory);
  app.route(prefix, resourceRoutes);

  // Metadata endpoint
  app.get(`${prefix}/metadata`, c => {
    const metadata = mtpc.exportMetadata();
    return c.json({ success: true, data: metadata });
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
export function createMinimalMTPCApp(mtpc, options = {}) {
  const { tenantOptions = {}, authOptions = {} } = options;

  const app = new Hono();

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
 * Mount MTPC routes on existing Hono app
 */
export function mountMTPC(app, mtpc, options = {}) {
  const {
    prefix = '/api',
    handlerFactory = createInMemoryHandlerFactory(),
    tenantOptions = {},
    authOptions = {},
  } = options;

  // Apply middleware to prefix
  app.use(`${prefix}/*`, mtpcMiddleware(mtpc));
  app.use(`${prefix}/*`, tenantMiddleware(tenantOptions));
  app.use(`${prefix}/*`, authMiddleware(authOptions));

  // Mount routes
  const resourceRoutes = createRPCRoutes(mtpc, handlerFactory);
  app.route(prefix, resourceRoutes);

  return app;
}
