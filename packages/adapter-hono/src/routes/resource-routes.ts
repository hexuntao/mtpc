import { zValidator } from '@hono/zod-validator';
import type { ResourceDefinition } from '@mtpc/core';
import { Hono } from 'hono';
import { getMTPCContext, getSubject, getTenant } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';

/**
 * Create CRUD routes for a resource
 */
export function createResourceRoutes(resource, handlers, options = {}) {
  const app = new Hono();
  const { prefix = '', middleware = [] } = options;

  // Apply middleware
  for (const mw of middleware) {
    app.use('*', mw);
  }

  const resourceName = resource.name;

  // List
  if (resource.features.list && handlers.list) {
    app.get('/', requirePermission(resourceName, 'list'), async c => {
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

  // Create
  if (resource.features.create && handlers.create) {
    app.post(
      '/',
      requirePermission(resourceName, 'create'),
      zValidator('json', resource.createSchema),
      async c => {
        const ctx = getMTPCContext(c);
        const data = c.req.valid('json');

        const result = await handlers.create(ctx, data);

        return c.json({ success: true, data: result }, 201);
      }
    );
  }

  // Read
  if (resource.features.read && handlers.read) {
    app.get('/:id', requirePermission(resourceName, 'read'), async c => {
      const ctx = getMTPCContext(c);
      const id = c.req.param('id');

      const result = await handlers.read(ctx, id);

      if (!result) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
          404
        );
      }

      return c.json({ success: true, data: result });
    });
  }

  // Update
  if (resource.features.update && handlers.update) {
    app.put(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');
        const data = c.req.valid('json');

        const result = await handlers.update(ctx, id, data);

        if (!result) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
            404
          );
        }

        return c.json({ success: true, data: result });
      }
    );
  }

  // Patch (partial update)
  if (resource.features.update && handlers.update) {
    app.patch(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      async c => {
        const ctx = getMTPCContext(c);
        const id = c.req.param('id');
        const data = c.req.valid('json');

        const result = await handlers.update(ctx, id, data);

        if (!result) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
            404
          );
        }

        return c.json({ success: true, data: result });
      }
    );
  }

  // Delete
  if (resource.features.delete && handlers.delete) {
    app.delete('/:id', requirePermission(resourceName, 'delete'), async c => {
      const ctx = getMTPCContext(c);
      const id = c.req.param('id');

      const result = await handlers.delete(ctx, id);

      if (!result) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Resource not found' } },
          404
        );
      }

      return c.json({ success: true, data: { deleted: true } });
    });
  }

  return app;
}

/**
 * Create all resource routes from registry
 */
export function createAllResourceRoutes(mtpc, handlerFactory, options = {}) {
  const app = new Hono();
  const { prefix = '/api' } = options;

  for (const resource of mtpc.registry.resources.list()) {
    const handlers = handlerFactory(resource);
    const routes = createResourceRoutes(resource, handlers);

    app.route(`${prefix}/${resource.name}`, routes);
  }

  return app;
}
