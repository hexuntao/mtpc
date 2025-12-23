import { zValidator } from '@hono/zod-validator';
import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
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
 * Parse query params to query options
 */
function parseQueryParams(query: ListQueryParams): QueryOptions {
  return {
    pagination: {
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    },
    sort: query.sort ? [{ field: query.sort, direction: 'asc' }] : [],
    filters: [],
  };
}

/**
 * Create CRUD routes for a resource
 */
export function createResourceRoutes<T>(
  resource: ResourceDefinition,
  handlers: CRUDHandlers<T>,
  options: ResourceRouteOptions = {}
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const { middleware = [] } = options;

  // Apply middleware
  for (const mw of middleware) {
    app.use('*', mw);
  }

  const resourceName = resource.name;

  // List
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

  // Create
  if (resource.features.create && handlers.create) {
    const createHandler = handlers.create;
    app.post(
      '/',
      requirePermission(resourceName, 'create'),
      zValidator('json', resource.createSchema),
      async c => {
        const ctx = getMTPCContext(c);
        const data = c.req.valid('json');

        const result = await createHandler(ctx, data);

        return c.json({ success: true, data: result } satisfies ApiResponse<T>, 201);
      }
    );
  }

  // Read
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
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
          } satisfies ApiResponse,
          404
        );
      }

      return c.json({ success: true, data: result } satisfies ApiResponse<T>);
    });
  }

  // Update
  if (resource.features.update && handlers.update) {
    const updateHandler = handlers.update;

    const handleUpdate = async (
      c: Parameters<typeof app.put>[1] extends (c: infer C) => unknown ? C : never
    ) => {
      const ctx = getMTPCContext(c);
      const id = c.req.param('id');
      const data = c.req.valid('json');

      const result = await updateHandler(ctx, id, data);

      if (!result) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
          } satisfies ApiResponse,
          404
        );
      }

      return c.json({ success: true, data: result } satisfies ApiResponse<T>);
    };

    app.put(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      handleUpdate
    );

    app.patch(
      '/:id',
      requirePermission(resourceName, 'update'),
      zValidator('json', resource.updateSchema),
      handleUpdate
    );
  }

  // Delete
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
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
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
 * Create all resource routes from registry
 */
export function createAllResourceRoutes<T>(
  mtpc: { registry: { resources: { list: () => ResourceDefinition[] } } },
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>,
  options: { prefix?: string } = {}
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const { prefix = '/api' } = options;

  for (const resource of mtpc.registry.resources.list()) {
    const handlers = handlerFactory(resource);
    const routes = createResourceRoutes(resource, handlers);

    app.route(`${prefix}/${resource.name}`, routes);
  }

  return app;
}
