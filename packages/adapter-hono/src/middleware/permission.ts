import { createPermissionCode, PermissionDeniedError, parsePermissionCode } from '@mtpc/shared';
import { createMiddleware } from 'hono/factory';
import { getMTPCContext, getSubject, getTenant } from '../context/mtpc-context.js';

/**
 * Permission check middleware
 */
export const requirePermission = (resourceOrCode, action) => {
  return createMiddleware(async (c, next) => {
    const mtpc = c.get('mtpc');

    if (!mtpc) {
      throw new Error('MTPC not initialized. Use mtpcMiddleware first.');
    }

    const tenant = getTenant(c);
    const subject = getSubject(c);

    // Parse permission code or construct from resource/action
    let resource;
    let permAction;

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
};

/**
 * Require any of the specified permissions
 */
export const requireAnyPermission = (...permissionCodes) => {
  return createMiddleware(async (c, next) => {
    const mtpc = c.get('mtpc');

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
};

/**
 * Require all of the specified permissions
 */
export const requireAllPermissions = (...permissionCodes) => {
  return createMiddleware(async (c, next) => {
    const mtpc = c.get('mtpc');

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
};

/**
 * Permission check with resource ID
 */
export const requireResourcePermission = (resource, action) => {
  return createMiddleware(async (c, next) => {
    const mtpc = c.get('mtpc');

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
};

/**
 * Dynamic permission check based on request
 */
export const dynamicPermissionCheck = resolver => {
  return createMiddleware(async (c, next) => {
    const mtpc = c.get('mtpc');

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
};
