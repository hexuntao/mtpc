import type { MTPCContext } from '@mtpc/core';

/**
 * Audit action category
 */
export type AuditCategory =
  | 'permission' // Permission checks
  | 'resource' // Resource CRUD
  | 'role' // Role / RBAC changes
  | 'policy' // Policy changes
  | 'system' // System-level events
  | 'custom'; // Custom events

/**
 * Audit decision/result
 */
export type AuditDecision = 'allow' | 'deny' | 'error' | 'info';

/**
 * Audit entry
 */
export interface AuditEntry {
  id: string;
  tenantId: string;
  timestamp: Date;

  // Who
  subjectId?: string;
  subjectType?: string;

  // What
  category: AuditCategory;
  action: string; // e.g. "check", "create", "update", "delete"
  resource?: string; // Resource name
  resourceId?: string; // Resource identifier
  permission?: string; // Permission code

  // Result
  decision: AuditDecision;
  success: boolean;
  reason?: string;

  // State
  before?: unknown;
  after?: unknown;

  // Request context
  ip?: string;
  userAgent?: string;
  requestId?: string;
  path?: string;
  method?: string;

  // Extra data
  metadata?: Record<string, unknown>;
}

/**
 * Audit entry input (without ID/timestamp)
 */
export type AuditEntryInput = Omit<AuditEntry, 'id' | 'timestamp'> & {
  timestamp?: Date;
};

/**
 * Audit query filter
 */
export interface AuditQueryFilter {
  tenantId?: string;
  subjectId?: string;
  resource?: string;
  resourceId?: string;
  category?: AuditCategory;
  decision?: AuditDecision;
  action?: string;
  permission?: string;
  from?: Date;
  to?: Date;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  filter?: AuditQueryFilter;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'tenant' | 'subject';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Audit query result
 */
export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Audit store interface (storage-agnostic)
 */
export interface AuditStore {
  log(entry: AuditEntry): Promise<void>;
  query(options?: AuditQueryOptions): Promise<AuditQueryResult>;
  count(filter?: AuditQueryFilter): Promise<number>;
  clear(filter?: AuditQueryFilter): Promise<void>;
}

/**
 * Audit options
 */
export interface AuditOptions {
  store?: AuditStore;
  async?: boolean;
  mask?: (entry: AuditEntry) => AuditEntry;
  include?: {
    permissionChecks?: boolean;
    resourceOperations?: boolean;
    roleChanges?: boolean;
    policyChanges?: boolean;
  };
}

/**
 * Normalized audit context (from MTPCContext)
 */
export interface NormalizedAuditContext {
  tenantId: string;
  subjectId?: string;
  subjectType?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  path?: string;
  method?: string;
}

/**
 * Audit plugin state
 */
export interface AuditPluginState {
  store: AuditStore;
  options: AuditOptions;
}

/**
 * Audit logger interface (high-level API)
 */
export interface AuditLogger {
  logPermissionCheck(params: {
    ctx: MTPCContext;
    permission: string;
    resource?: string;
    resourceId?: string;
    decision: AuditDecision;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  logResourceOperation(params: {
    ctx: MTPCContext;
    operation: string; // "create" | "read" | "update" | "delete" | ...
    resource: string;
    resourceId?: string;
    success: boolean;
    before?: unknown;
    after?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  logRoleChange(params: {
    ctx: MTPCContext;
    action: string; // "assign" | "revoke" | "createRole" | ...
    subjectId?: string;
    role?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  logPolicyChange(params: {
    ctx: MTPCContext;
    action: string; // "createPolicy" | "updatePolicy" | ...
    policyId?: string;
    success: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  logCustom(params: {
    ctx: MTPCContext;
    category?: AuditCategory;
    action: string;
    resource?: string;
    resourceId?: string;
    decision?: AuditDecision;
    success?: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  query(options?: AuditQueryOptions): Promise<AuditQueryResult>;
  count(filter?: AuditQueryFilter): Promise<number>;
  clear(filter?: AuditQueryFilter): Promise<void>;
}
