import type { MTPC } from '@mtpc/core';
import { createPermissionCode, PermissionDeniedError, parsePermissionCode } from '@mtpc/shared';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getSubject, getTenant } from '../context/mtpc-context.js';
import type { DynamicPermissionResolver, MTPCEnv } from '../types.js';

/**
 * Permission check middleware
 */
export function requirePermission(
  resourceOrCode: string,
  action?: string
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // Parse permission code or construct from resource/action
    let resource: string;
    let permAction: string;

    if (action) {
      resource = resourceOrCode;
      permAction = action;
    } else {
      const parsed = parsePermissionCode(resourceOrCode);
      if (!parsed) {
        throw new Error(`Invalid permission code: ${resourceOrCode}`);
      }
      resource = parsed.resource;
      permAction = parsed.action;
    }

    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action: permAction,
    });

    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, permAction), {
        reason: result.reason,
      });
    }

    await next();
  });
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(...permissionCodes: string[]): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    for (const code of permissionCodes) {
      const parsed = parsePermissionCode(code);

      if (!parsed) {
        continue;
      }

      const result = await mtpc.checkPermission({
        tenant,
        subject,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (result.allowed) {
        await next();
        return;
      }
    }

    throw new PermissionDeniedError(permissionCodes.join(' OR '), {
      reason: 'None of the required permissions granted',
    });
  });
}

/**
 * Require all of the specified permissions
 */
export function requireAllPermissions(...permissionCodes: string[]): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    for (const code of permissionCodes) {
      const parsed = parsePermissionCode(code);

      if (!parsed) {
        throw new Error(`Invalid permission code: ${code}`);
      }

      const result = await mtpc.checkPermission({
        tenant,
        subject,
        resource: parsed.resource,
        action: parsed.action,
      });

      if (!result.allowed) {
        throw new PermissionDeniedError(code, { reason: result.reason });
      }
    }

    await next();
  });
}

/**
 * Permission check with resource ID
 */
export function requireResourcePermission(
  resource: string,
  action: string
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);
    const resourceId = c.req.param('id');

    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action,
      resourceId,
    });

    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, action), {
        reason: result.reason,
        resourceId,
      });
    }

    await next();
  });
}

/**
 * Dynamic permission check based on request
 */
export function dynamicPermissionCheck(
  resolver: DynamicPermissionResolver
): MiddlewareHandler<MTPCEnv> {
  return createMiddleware<MTPCEnv>(async (c, next) => {
    const mtpc = c.get('mtpc') as MTPC;

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    const { resource, action, resourceId } = await resolver(c);

    const result = await mtpc.checkPermission({
      tenant,
      subject,
      resource,
      action,
      resourceId,
    });

    if (!result.allowed) {
      throw new PermissionDeniedError(createPermissionCode(resource, action), {
        reason: result.reason,
      });
    }

    await next();
  });
}
