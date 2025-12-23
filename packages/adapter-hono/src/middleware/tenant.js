import { createHeaderResolver, createTenantContext, validateTenantContext } from '@mtpc/core';
import { MissingTenantContextError } from '@mtpc/shared';
import { createMiddleware } from 'hono/factory';
import { setTenant } from '../context/mtpc-context.js';

/**
 * Tenant resolution options
 */
export const tenantMiddleware = (options = {}) => {
  const { headerName = 'x-tenant-id', required = true, defaultTenantId, validate } = options;

  return createMiddleware(async (c, next) => {
    // Try to resolve tenant from header
    const tenantId = c.req.header(headerName) ?? c.req.header(headerName.toLowerCase());

    if (!tenantId) {
      if (defaultTenantId) {
        const tenant = createTenantContext(defaultTenantId);
        setTenant(c, tenant);
        return next();
      }

      if (required) {
        throw new MissingTenantContextError();
      }

      return next();
    }

    // Create tenant context
    const tenant = createTenantContext(tenantId);

    // Validate if validator provided
    if (validate) {
      const isValid = await validate(tenant);
      if (!isValid) {
        throw new MissingTenantContextError();
      }
    }

    // Validate tenant status
    validateTenantContext(tenant);

    // Set in context
    setTenant(c, tenant);

    await next();
  });
};

/**
 * Tenant from path parameter middleware
 */
export const tenantFromPathMiddleware = (options = {}) => {
  const { paramName = 'tenantId', required = true } = options;

  return createMiddleware(async (c, next) => {
    const tenantId = c.req.param(paramName);

    if (!tenantId) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    const tenant = createTenantContext(tenantId);
    validateTenantContext(tenant);
    setTenant(c, tenant);

    await next();
  });
};

/**
 * Tenant from subdomain middleware
 */
export const tenantFromSubdomainMiddleware = (options = {}) => {
  const { baseDomain, required = true } = options;

  return createMiddleware(async (c, next) => {
    const host = c.req.header('host') ?? '';

    if (!baseDomain || !host.endsWith(baseDomain)) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    const subdomain = host.slice(0, -(baseDomain.length + 1));

    if (!subdomain || subdomain.includes('.')) {
      if (required) {
        throw new MissingTenantContextError();
      }
      return next();
    }

    const tenant = createTenantContext(subdomain);
    validateTenantContext(tenant);
    setTenant(c, tenant);

    await next();
  });
};
