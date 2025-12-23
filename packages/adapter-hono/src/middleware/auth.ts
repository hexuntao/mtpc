import type { SubjectContext } from '@mtpc/core';
import { ANONYMOUS_SUBJECT } from '@mtpc/core';
import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { setSubject } from '../context/mtpc-context.js';
import type {
  ApiKeyAuthOptions,
  AuthMiddlewareOptions,
  BearerAuthOptions,
  MTPCEnv,
} from '../types.js';

/**
 * Simple auth middleware that extracts subject from header
 */
export function authMiddleware(options: AuthMiddlewareOptions = {}): MiddlewareHandler<MTPCEnv> {
  const {
    headerName = 'x-subject-id',
    roleHeaderName = 'x-subject-roles',
    required = false,
    resolver,
  } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
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

    const subject: SubjectContext = {
      id: subjectId,
      type: 'user',
      roles,
      permissions: [],
    };

    setSubject(c, subject);
    await next();
  });
}

/**
 * Bearer token auth middleware
 */
export function bearerAuthMiddleware(options: BearerAuthOptions): MiddlewareHandler<MTPCEnv> {
  const { verifyToken, required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
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
}

/**
 * API key auth middleware
 */
export function apiKeyAuthMiddleware(options: ApiKeyAuthOptions): MiddlewareHandler<MTPCEnv> {
  const { headerName = 'x-api-key', verifyApiKey, required = true } = options;

  return createMiddleware<MTPCEnv>(async (c, next) => {
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
}
