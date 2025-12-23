import type { MTPCContext, ResourceDefinition } from '@mtpc/core';
import type { Context, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { getMTPCContext } from '../context/mtpc-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { ApiResponse, MTPCEnv } from '../types.js';

/**
 * Route definition
 */
interface RouteDefinition {
  name: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  handler: (c: Context<MTPCEnv>, ctx: MTPCContext) => Promise<unknown>;
  permission: string | null;
}

/**
 * Action options
 */
interface ActionOptions {
  permission?: string;
  path?: string;
}

/**
 * Route builder for fluent API
 */
export class RouteBuilder {
  private resource: ResourceDefinition;
  private app: Hono<MTPCEnv>;
  private middlewares: MiddlewareHandler<MTPCEnv>[] = [];
  private routes: RouteDefinition[] = [];

  constructor(resource: ResourceDefinition) {
    this.resource = resource;
    this.app = new Hono<MTPCEnv>();
  }

  /**
   * Add middleware
   */
  use(middleware: MiddlewareHandler<MTPCEnv>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Add custom action route
   */
  action(
    name: string,
    method: RouteDefinition['method'],
    handler: RouteDefinition['handler'],
    options: ActionOptions = {}
  ): this {
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
  get(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'get', handler, { path, permission });
  }

  /**
   * Add POST route
   */
  post(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'post', handler, { path, permission });
  }

  /**
   * Add PUT route
   */
  put(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'put', handler, { path, permission });
  }

  /**
   * Add DELETE route
   */
  delete(path: string, handler: RouteDefinition['handler'], permission?: string): this {
    return this.action(path.replace(/^\//, ''), 'delete', handler, { path, permission });
  }

  /**
   * Build routes
   */
  build(): Hono<MTPCEnv> {
    // Apply global middleware
    for (const mw of this.middlewares) {
      this.app.use('*', mw);
    }

    // Register routes
    for (const route of this.routes) {
      const handlers: MiddlewareHandler<MTPCEnv>[] = [];

      if (route.permission) {
        handlers.push(requirePermission(route.permission));
      }

      const routeHandler = async (c: Context<MTPCEnv>): Promise<Response> => {
        const ctx = getMTPCContext(c);
        const result = await route.handler(c, ctx);

        if (result instanceof Response) {
          return result;
        }

        return c.json({ success: true, data: result } satisfies ApiResponse);
      };

      handlers.push(routeHandler);

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
export function createRouteBuilder(resource: ResourceDefinition): RouteBuilder {
  return new RouteBuilder(resource);
}
