import { ANONYMOUS_SUBJECT } from '@mtpc/core';
import { createMiddleware } from 'hono/factory';
import { setSubject } from '../context/mtpc-context.js';

/**
 * Auth middleware options
 */

/**
 * Simple auth middleware that extracts subject from header
 */
export const authMiddleware = (options = {}) => {
  const {
    headerName = 'x-subject-id',
    roleHeaderName = 'x-subject-roles',
    required = false,
    resolver,
  } = options;

  return createMiddleware(async (c, next) => {
    // Use custom resolver if provided
    if (resolver) {
      const subject = await resolver(c);
      if (subject) {
        setSubject(c, subject);
        return next();
      }

      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    // Default: extract from headers
    const subjectId = c.req.header(headerName);

    if (!subjectId) {
      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    // Parse roles from header
    const rolesHeader = c.req.header(roleHeaderName);
    const roles = rolesHeader ? rolesHeader.split(',').map(r => r.trim()) : [];

    const subject = {
      id: subjectId,
      type: 'user',
      roles,
      permissions: [],
    };

    setSubject(c, subject);
    await next();
  });
};

/**
 * Bearer token auth middleware
 */
export const bearerAuthMiddleware = options => {
  const { verifyToken, required = true } = options;

  return createMiddleware(async (c, next) => {
    const authHeader = c.req.header('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      if (required) {
        return c.json({ error: 'Bearer token required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    const token = authHeader.slice(7);

    try {
      const subject = await verifyToken(token);
      setSubject(c, subject);
      await next();
    } catch (error) {
      if (required) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      await next();
    }
  });
};

/**
 * API key auth middleware
 */
export const apiKeyAuthMiddleware = options => {
  const { headerName = 'x-api-key', verifyApiKey, required = true } = options;

  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header(headerName);

    if (!apiKey) {
      if (required) {
        return c.json({ error: 'API key required' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      return next();
    }

    try {
      const subject = await verifyApiKey(apiKey);
      setSubject(c, subject);
      await next();
    } catch (error) {
      if (required) {
        return c.json({ error: 'Invalid API key' }, 401);
      }

      setSubject(c, ANONYMOUS_SUBJECT);
      await next();
    }
  });
};
