import type { MTPC } from '@mtpc/core';
import { createMiddleware } from 'hono/factory';

/**
 * Main MTPC middleware - injects MTPC instance into context
 */
export const mtpcMiddleware = mtpc => {
  return createMiddleware(async (c, next) => {
    c.set('mtpc', mtpc);
    await next();
  });
};

/**
 * Combined MTPC setup middleware
 */
export const setupMTPC = options => {
  const { mtpc, tenantOptions = {}, authOptions = {} } = options;

  return createMiddleware(async (c, next) => {
    // Set MTPC instance
    c.set('mtpc', mtpc);

    await next();
  });
};
