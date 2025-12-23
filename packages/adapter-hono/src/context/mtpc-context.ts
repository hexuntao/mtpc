import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';
import { ANONYMOUS_SUBJECT, createContext } from '@mtpc/core';
import type { Context } from 'hono';
import type { MTPCEnv } from './variables.js';

/**
 * Get tenant from Hono context
 */
export function getTenant(c: Context<MTPCEnv>): TenantContext {
  return c.get('tenant');
}

/**
 * Get subject from Hono context
 */
export function getSubject(c: Context<MTPCEnv>): SubjectContext {
  return c.get('subject') ?? ANONYMOUS_SUBJECT;
}

/**
 * Get full MTPC context from Hono context
 */
export function getMTPCContext(c: Context<MTPCEnv>): MTPCContext {
  return c.get('mtpcContext');
}

/**
 * Set tenant in Hono context
 */
export function setTenant(c: Context<MTPCEnv>, tenant: TenantContext): void {
  c.set('tenant', tenant);
  updateMTPCContext(c);
}

/**
 * Set subject in Hono context
 */
export function setSubject(c: Context<MTPCEnv>, subject: SubjectContext): void {
  c.set('subject', subject);
  updateMTPCContext(c);
}

/**
 * Update MTPC context (called after tenant/subject changes)
 */
function updateMTPCContext(c: Context<MTPCEnv>): void {
  const tenant = c.get('tenant');
  const subject = c.get('subject') ?? ANONYMOUS_SUBJECT;

  if (tenant) {
    const mtpcContext = createContext({
      tenant,
      subject,
      request: {
        requestId: c.req.header('x-request-id') ?? generateRequestId(),
        timestamp: new Date(),
        ip: getClientIp(c),
        userAgent: c.req.header('user-agent'),
        path: c.req.path,
        method: c.req.method,
      },
    });

    c.set('mtpcContext', mtpcContext);
  }
}

/**
 * Get client IP from request
 */
function getClientIp(c: Context): string | undefined {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? undefined
  );
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create MTPC context from Hono context
 */
export function createMTPCContextFromHono(
  c: Context<MTPCEnv>,
  tenant: TenantContext,
  subject?: SubjectContext
): MTPCContext {
  return createContext({
    tenant,
    subject: subject ?? ANONYMOUS_SUBJECT,
    request: {
      requestId: c.req.header('x-request-id') ?? generateRequestId(),
      timestamp: new Date(),
      ip: getClientIp(c),
      userAgent: c.req.header('user-agent'),
      path: c.req.path,
      method: c.req.method,
    },
  });
}
