import { DEFAULT_TENANT_HEADER } from '@mtpc/shared';
import type { TenantContext, TenantResolver } from '../types/index.js';
import { createTenantContext } from './context.js';

/**
 * Create a header-based tenant resolver
 */
export function createHeaderResolver(
  headerName: string = DEFAULT_TENANT_HEADER
): TenantResolver<{ headers: Record<string, string | undefined> }> {
  return request => {
    const tenantId = request.headers[headerName] ?? request.headers[headerName.toLowerCase()];

    if (!tenantId) {
      return null;
    }

    return createTenantContext(tenantId);
  };
}

/**
 * Create a subdomain-based tenant resolver
 */
export function createSubdomainResolver(baseDomain: string): TenantResolver<{ hostname: string }> {
  return request => {
    const { hostname } = request;

    if (!hostname.endsWith(baseDomain)) {
      return null;
    }

    const subdomain = hostname.slice(0, -(baseDomain.length + 1));

    if (!subdomain || subdomain.includes('.')) {
      return null;
    }

    return createTenantContext(subdomain);
  };
}

/**
 * Create a path-based tenant resolver
 */
export function createPathResolver(prefix: string = '/tenant/'): TenantResolver<{ path: string }> {
  return request => {
    const { path } = request;

    if (!path.startsWith(prefix)) {
      return null;
    }

    const remaining = path.slice(prefix.length);
    const tenantId = remaining.split('/')[0];

    if (!tenantId) {
      return null;
    }

    return createTenantContext(tenantId);
  };
}

/**
 * Create a query parameter-based tenant resolver
 */
export function createQueryResolver(
  paramName: string = 'tenant'
): TenantResolver<{ query: Record<string, string | undefined> }> {
  return request => {
    const tenantId = request.query[paramName];

    if (!tenantId) {
      return null;
    }

    return createTenantContext(tenantId);
  };
}

/**
 * Create a composite resolver that tries multiple strategies
 */
export function createCompositeResolver<T>(...resolvers: TenantResolver<T>[]): TenantResolver<T> {
  return async request => {
    for (const resolver of resolvers) {
      const tenant = await resolver(request);
      if (tenant) {
        return tenant;
      }
    }
    return null;
  };
}

/**
 * Create a resolver with fallback
 */
export function createResolverWithFallback<T>(
  resolver: TenantResolver<T>,
  fallback: TenantContext
): TenantResolver<T> {
  return async request => {
    const tenant = await resolver(request);
    return tenant ?? fallback;
  };
}

/**
 * Create a resolver with validation
 */
export function createValidatingResolver<T>(
  resolver: TenantResolver<T>,
  validator: (tenant: TenantContext) => Promise<boolean> | boolean
): TenantResolver<T> {
  return async request => {
    const tenant = await resolver(request);

    if (!tenant) {
      return null;
    }

    const isValid = await validator(tenant);
    return isValid ? tenant : null;
  };
}
