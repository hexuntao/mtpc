import type { ResourceDefinition } from '@mtpc/core';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';

/**
 * Route builder for fluent API
 */
export class RouteBuilder {
  constructor(resource) {
    this.resource = resource;
    this.app = new Hono();
    this.middlewares = [];
    this.routes = [];
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add custom action route
   */
  action(name, method, handler, options = {}) {
    const { permission, path = `/:${name}` } = options;

    this.routes.push({
      name,
      method,
      path,
      handler,
      permission: permission ?? `${this.resource.name}:${name}`,
    });

    return this;
  }

  /**
   * Add GET route
   */
  get(path, handler, permission) {
    return this.action(path.replace(/^//, ''), 'get', handler, { path, permission });
  }

  /**
   * Add POST route
   */
  post(path, handler, permission) {
    return this.action(path.replace(/^//, ''), 'post', handler, { path, permission });
  }

  /**
   * Add PUT route
   */
  put(path, handler, permission) {
    return this.action(path.replace(/^//, ''), 'put', handler, { path, permission });
  }

  /**
   * Add DELETE route
   */
  delete(path, handler, permission) {
    return this.action(path.replace(/^//, ''), 'delete', handler, { path, permission });
  }

  /**
   * Build routes
   */
  build() {
    // Apply global middleware
    for (const mw of this.middlewares) {
      this.app.use('*', mw);
    }

    // Register routes
    for (const route of this.routes) {
      const handlers = [];

      if (route.permission) {
        handlers.push(requirePermission(route.permission));
      }

      handlers.push(async c => {
        const ctx = getMTPCContext(c);
        const result = await route.handler(c, ctx);

        if (result instanceof Response) {
          return result;
        }

        return c.json({ success: true, data: result });
      });

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
 * Create route builder for resource
 */
export function createRouteBuilder(resource) {
  return new RouteBuilder(resource);
}
