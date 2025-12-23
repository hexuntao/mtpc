import type { SubjectContext } from './context.js';
import type { TenantContext } from './tenant.js';

/**
 * Default CRUD actions
 */
export type CRUDAction = 'create' | 'read' | 'update' | 'delete' | 'list';

/**
 * Permission action - can be CRUD or custom
 */
export type PermissionAction = CRUDAction | string;

/**
 * Permission scope
 */
export type PermissionScope = 'global' | 'tenant' | 'own';

/**
 * Permission definition
 */
export interface PermissionDefinition {
  action: PermissionAction;
  description?: string;
  scope?: PermissionScope;
  conditions?: PermissionCondition[];
  metadata?: Record<string, unknown>;
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  field: string;
  operator: PermissionConditionOperator;
  value: unknown;
}

/**
 * Permission condition operator
 */
export type PermissionConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'matches';

/**
 * Compiled permission
 */
export interface Permission {
  readonly code: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly scope: PermissionScope;
  readonly description?: string;
  readonly conditions: PermissionCondition[];
  readonly metadata: Record<string, unknown>;
}

/**
 * Permission code format: "resource:action"
 */
export type PermissionCode<
  TResource extends string = string,
  TAction extends string = string,
> = `${TResource}:${TAction}`;

/**
 * Permission check context
 */
export interface PermissionCheckContext {
  tenant: TenantContext;
  subject: SubjectContext;
  resource: string;
  action: string;
  resourceId?: string;
  data?: Record<string, unknown>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  reason?: string;
  matchedPolicies?: string[];
  evaluationTime?: number;
}

/**
 * Batch permission check result
 */
export interface BatchPermissionCheckResult {
  results: Map<string, PermissionCheckResult>;
  allAllowed: boolean;
  anyAllowed: boolean;
}

/**
 * Permission evaluator function
 */
export type PermissionEvaluator = (
  context: PermissionCheckContext
) => Promise<PermissionCheckResult>;

/**
 * Permission set - for caching and bulk operations
 */
export interface PermissionSet {
  permissions: Set<string>;
  tenantId: string;
  subjectId: string;
  expiresAt?: Date;
}
