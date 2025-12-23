import type { TenantContext } from './tenant.js';

/**
 * Subject type
 */
export type SubjectType = 'user' | 'service' | 'system' | 'anonymous';

/**
 * Subject context - who is performing the action
 */
export interface SubjectContext {
  readonly id: string;
  readonly type: SubjectType;
  readonly roles?: string[];
  readonly permissions?: string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Anonymous subject
 */
export const ANONYMOUS_SUBJECT: SubjectContext = {
  id: 'anonymous',
  type: 'anonymous',
  roles: [],
  permissions: [],
} as const;

/**
 * System subject
 */
export const SYSTEM_SUBJECT: SubjectContext = {
  id: 'system',
  type: 'system',
  roles: ['system'],
  permissions: ['*'],
} as const;

/**
 * Request context
 */
export interface RequestContext {
  readonly requestId: string;
  readonly timestamp: Date;
  readonly ip?: string;
  readonly userAgent?: string;
  readonly path?: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
}

/**
 * Full MTPC context
 */
export interface MTPCContext {
  readonly tenant: TenantContext;
  readonly subject: SubjectContext;
  readonly request: RequestContext;
}

/**
 * Context builder options
 */
export interface ContextBuilderOptions {
  tenant: TenantContext;
  subject?: SubjectContext;
  request?: Partial<RequestContext>;
}

/**
 * Create a full MTPC context
 */
export function createContext(options: ContextBuilderOptions): MTPCContext {
  return {
    tenant: options.tenant,
    subject: options.subject ?? ANONYMOUS_SUBJECT,
    request: {
      requestId: options.request?.requestId ?? generateRequestId(),
      timestamp: options.request?.timestamp ?? new Date(),
      ip: options.request?.ip,
      userAgent: options.request?.userAgent,
      path: options.request?.path,
      method: options.request?.method,
      headers: options.request?.headers,
    },
  };
}

/**
 * Generate a simple request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
