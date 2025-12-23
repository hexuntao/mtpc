import { zValidator } from '@hono/zod-validator';
import type {
  MTPC,
  MTPCContext,
  PaginatedResult,
  QueryOptions,
  ResourceDefinition,
} from '@mtpc/core';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { ApiResponse, CRUDHandlers, ListQueryParams, MTPCEnv } from '../types.js';

/**
 * Parse query params
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
 * Create RPC routes for resources
 */
export function createRPCRoutes<T>(
  mtpc: MTPC,
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();

  for (const resource of mtpc.registry.resources.list()) {
    const handlers = handlerFactory(resource);
    const basePath = `/${resource.name}`;

    // List endpoint
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

    // Create endpoint
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

    // Read endpoint
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
              error: { code: 'NOT_FOUND', message: 'Resource not found' },
            } satisfies ApiResponse,
            404
          );
        }

        return c.json({ success: true, data: result } satisfies ApiResponse<T>);
      });
    }

    // Update endpoint
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
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        handleUpdate
      );

      app.patch(
        `${basePath}/:id`,
        requirePermission(resource.name, 'update'),
        zValidator('json', resource.updateSchema),
        handleUpdate
      );
    }

    // Delete endpoint
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
  }

  return app;
}

/**
 * Create typed RPC app
 */
export function createTypedRPCApp<T>(
  mtpc: MTPC,
  handlerFactory: (resource: ResourceDefinition) => CRUDHandlers<T>
): Hono<MTPCEnv> {
  const app = new Hono<MTPCEnv>();
  const routes = createRPCRoutes(mtpc, handlerFactory);

  app.route('/api', routes);

  return app;
}
