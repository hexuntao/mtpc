import type { MTPCContext } from '@mtpc/core';
import { InMemoryAuditStore } from './store/memory-store.js';
import type {
  AuditCategory,
  AuditDecision,
  AuditEntry,
  AuditEntryInput,
  AuditLogger,
  AuditOptions,
  AuditQueryFilter,
  AuditQueryOptions,
  AuditQueryResult,
  AuditStore,
} from './types.js';

/**
 * Normalize context into audit fields
 */
function normalizeContextFields(ctx: MTPCContext): {
  tenantId: string;
  subjectId?: string;
  subjectType?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  path?: string;
  method?: string;
} {
  return {
    tenantId: ctx.tenant.id,
    subjectId: ctx.subject.id,
    subjectType: ctx.subject.type,
    ip: ctx.request.ip,
    userAgent: ctx.request.userAgent,
    requestId: ctx.request.requestId,
    path: ctx.request.path,
    method: ctx.request.method,
  };
}

/**
 * Audit service - high-level logger API
 */
export class Audit implements AuditLogger {
  private store: AuditStore;
  private options: AuditOptions;
  private idCounter = 0;

  constructor(options: AuditOptions = {}) {
    this.options = options;
    this.store = options.store ?? new InMemoryAuditStore();
  }

  private generateId(): string {
    return `audit_${++this.idCounter}_${Date.now()}`;
  }

  private async logInternal(entryInput: AuditEntryInput): Promise<void> {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: entryInput.timestamp ?? new Date(),
      ...entryInput,
    };

    const masked = this.options.mask ? this.options.mask(entry) : entry;

    if (this.options.async) {
      void this.store.log(masked);
    } else {
      await this.store.log(masked);
    }
  }

  async logPermissionCheck(params: {
    ctx: MTPCContext;
    permission: string;
    resource?: string;
    resourceId?: string;
    decision: AuditDecision;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (this.options.include?.permissionChecks === false) {
      return;
    }

    const norm = normalizeContextFields(params.ctx);
    const [res, act] = params.permission.split(':');

    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'permission',
      action: 'check',
      resource: params.resource ?? res,
      resourceId: params.resourceId,
      permission: params.permission,
      decision: params.decision,
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: {
        ...params.metadata,
        action: act,
      },
    });
  }

  async logResourceOperation(params: {
    ctx: MTPCContext;
    operation: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (this.options.include?.resourceOperations === false) {
      return;
    }

    const norm = normalizeContextFields(params.ctx);

    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'resource',
      action: params.operation,
      resource: params.resource,
      resourceId: params.resourceId,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      before: params.before,
      after: params.after,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  async logRoleChange(params: {
    ctx: MTPCContext;
    action: string;
    subjectId?: string;
    role?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (this.options.include?.roleChanges === false) {
      return;
    }

    const norm = normalizeContextFields(params.ctx);

    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'role',
      action: params.action,
      resource: 'role',
      resourceId: params.role,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: {
        ...params.metadata,
        targetSubjectId: params.subjectId,
        role: params.role,
      },
    });
  }

  async logPolicyChange(params: {
    ctx: MTPCContext;
    action: string;
    policyId?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (this.options.include?.policyChanges === false) {
      return;
    }

    const norm = normalizeContextFields(params.ctx);

    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: 'policy',
      action: params.action,
      resource: 'policy',
      resourceId: params.policyId,
      decision: params.success ? 'info' : 'error',
      success: params.success,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  async logCustom(params: {
    ctx: MTPCContext;
    category?: AuditCategory;
    action: string;
    resource?: string;
    resourceId?: string;
    decision?: AuditDecision;
    success?: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const norm = normalizeContextFields(params.ctx);

    await this.logInternal({
      tenantId: norm.tenantId,
      subjectId: norm.subjectId,
      subjectType: norm.subjectType,
      category: params.category ?? 'custom',
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      decision: params.decision ?? (params.success === false ? 'error' : 'info'),
      success: params.success ?? true,
      reason: params.reason,
      ip: norm.ip,
      userAgent: norm.userAgent,
      requestId: norm.requestId,
      path: norm.path,
      method: norm.method,
      metadata: params.metadata,
    });
  }

  async query(options?: AuditQueryOptions): Promise<AuditQueryResult> {
    return this.store.query(options);
  }

  async count(filter?: AuditQueryFilter): Promise<number> {
    return this.store.count(filter);
  }

  async clear(filter?: AuditQueryFilter): Promise<void> {
    await this.store.clear(filter);
  }

  /**
   * Get underlying store
   */
  getStore(): AuditStore {
    return this.store;
  }
}

/**
 * Create an Audit logger instance
 */
export function createAudit(options?: AuditOptions): Audit {
  return new Audit(options);
}
