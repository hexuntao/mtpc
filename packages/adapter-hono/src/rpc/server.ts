import { zValidator } from '@hono/zod-validator';
import type { MTPC, ResourceDefinition } from '@mtpc/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';

/**
 * RPC handler type
 */

/**
 * Create RPC routes for resources
 */
export function createRPCRoutes(mtpc, handlerFactory) {
  const app = new Hono();

  for (const resource of mtpc.registry.resources.list()) {
    const handlers = handlerFactory(resource);
    const basePath = `/${resource.name}`;

    // List endpoint
    if (resource.features.list) {
      app.get(basePath, requirePermission(resource.name, 'list'), async c => {
        const ctx = getMTPCContext(c);
        const query = c.req.query();

        const result = await handlers.list(ctx, {
          page: query.page ? parseInt(query.page) : 1,
          pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
          sort: query.sort,
          filter: query.filter,
        });

        return c.json({ success: true, data: result });
      });
    }

    // Create endpoint
    if (resource.features.create) {
      app.post(
        basePath,
        requirePermission(resource.name, 'create'),
        zValidator('json', resource.createSchema),
        async c => {
          const ctx = getMTPCContext(c);
          const data = c.req.valid('json');

          const result = await handlers.create(ctx, data);

          return c.json({ success: true, data: result }, 201);
        }
      );
    }

    // Read endpoint
    if (resource.features.read) {
      app.get(`${basePath}/:id`, requirePermission(resource.name, 'read'), async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');

        const result = await handlers.read(ctx, id);

        if (!result) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Resource not found' },
            },
            404
          );
        }

        return c.json({ success: true, data: result });
      });
    }

    // Update endpoint
    if (resource.features.update) {
      app.put(
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        async c => {
          const ctx = getMTPCContext(c);
          const id = c.req.param('id');
          const data = c.req.valid('json');

          const result = await handlers.update(ctx, id, data);

          if (!result) {
            return c.json(
              {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Resource not found' },
              },
              404
            );
          }

          return c.json({ success: true, data: result });
        }
      );

      // Also support PATCH
      app.patch(
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        async c => {
          const ctx = getMTPCContext(c);
          const id = c.req.param('id');
          const data = c.req.valid('json');

          const result = await handlers.update(ctx, id, data);

          if (!result) {
            return c.json(
              {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Resource not found' },
              },
              404
            );
          }

          return c.json({ success: true, data: result });
        }
      );
    }

    // Delete endpoint
    if (resource.features.delete) {
      app.delete(`${basePath}/:id`, requirePermission(resource.name, 'delete'), async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');

        const result = await handlers.delete(ctx, id);

        if (!result) {
          return c.json(
            {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Resource not found' },
            },
            404
          );
        }

        return c.json({ success: true, data: { deleted: true } });
      });
    }
  }

  return app;
}

/**
 * Create typed RPC app
 */
export function createTypedRPCApp(mtpc, handlerFactory) {
  const app = new Hono();
  const routes = createRPCRoutes(mtpc, handlerFactory);

  app.route('/api', routes);

  return app;
}
