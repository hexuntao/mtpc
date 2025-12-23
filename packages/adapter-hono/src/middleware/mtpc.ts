import type { MTPC } from '@mtpc/core';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AuthMiddlewareOptions, MTPCEnv, TenantMiddlewareOptions } from '../types.js';

/**
 * Main MTPC middleware - injects MTPC instance into context
 */
export function mtpcMiddleware(mtpc: MTPC): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    c.set('mtpc', mtpc);
    await next();
  });
}

/**
 * Combined MTPC setup options
 */
export interface SetupMTPCOptions {
  mtpc: MTPC;
  tenantOptions?: TenantMiddlewareOptions;
  authOptions?: AuthMiddlewareOptions;
}

/**
 * Combined MTPC setup middleware
 */
export function setupMTPC(options: SetupMTPCOptions): MiddlewareHandler<MTPCEnv> {
  const { mtpc } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
    // Set MTPC instance
    c.set('mtpc', mtpc);
    await next();
  });
}
