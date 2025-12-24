import type { FilterCondition, FilterOperator, MTPCContext } from '@mtpc/core';

/**
 * Scope type - predefined scope patterns
 */
export type ScopeType =
  | 'all' // No restrictions (admin)
  | 'tenant' // All data in tenant
  | 'department' // Same department
  | 'team' // Same team
  | 'self' // Only own data
  | 'subordinates' // Self + subordinates
  | 'custom'; // Custom condition

/**
 * Scope value resolver
 */
export type ScopeValueResolver = (ctx: MTPCContext) => unknown | Promise<unknown>;

/**
 * Scope condition operator
 */
export type ScopeConditionOperator =
  | 'eq' // Equal
  | 'neq' // Not equal
  | 'in' // In array
  | 'notIn' // Not in array
  | 'contains' // Array contains
  | 'hierarchy'; // Hierarchical (parent-child)

/**
 * Scope condition definition
 */
export interface ScopeCondition {
  /** Field to check on the resource */
  field: string;
  /** Operator for comparison */
  operator: ScopeConditionOperator;
  /** Static value or resolver function */
  value: unknown | ScopeValueResolver;
  /** Optional: field path in context to compare */
  contextField?: string;
}

/**
 * Data scope definition
 */
export interface DataScopeDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Scope type */
  type: ScopeType;
  /** Conditions to apply (for custom type) */
  conditions?: ScopeCondition[];
  /** Priority (higher = evaluated first) */
  priority?: number;
  /** Whether this scope can be combined with others */
  combinable?: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resolved scope - scope with resolved values
 */
export interface ResolvedScope {
  definition: DataScopeDefinition;
  filters: FilterCondition[];
  resolvedAt: Date;
}

/**
 * Scope assignment - links scope to resource/role/subject
 */
export interface ScopeAssignment {
  id: string;
  tenantId: string;
  /** Scope definition ID */
  scopeId: string;
  /** Target type */
  targetType: 'resource' | 'role' | 'subject';
  /** Target identifier */
  targetId: string;
  /** Optional: specific permission this applies to */
  permission?: string;
  /** Assignment priority */
  priority?: number;
  /** Enabled flag */
  enabled: boolean;
  /** Metadata */
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Scope resolution context
 */
export interface ScopeResolutionContext {
  mtpcContext: MTPCContext;
  resourceName: string;
  action: string;
  existingFilters?: FilterCondition[];
}

/**
 * Scope resolution result
 */
export interface ScopeResolutionResult {
  scopes: ResolvedScope[];
  combinedFilters: FilterCondition[];
  appliedScopeIds: string[];
  resolvedAt: Date;
}

/**
 * Data scope store interface
 */
export interface DataScopeStore {
  // Scope definitions
  createScope(scope: Omit<DataScopeDefinition, 'id'>): Promise<DataScopeDefinition>;
  updateScope(
    id: string,
    updates: Partial<DataScopeDefinition>
  ): Promise<DataScopeDefinition | null>;
  deleteScope(id: string): Promise<boolean>;
  getScope(id: string): Promise<DataScopeDefinition | null>;
  listScopes(): Promise<DataScopeDefinition[]>;

  // Assignments
  createAssignment(
    assignment: Omit<ScopeAssignment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ScopeAssignment>;
  deleteAssignment(id: string): Promise<boolean>;
  getAssignmentsForTarget(
    tenantId: string,
    targetType: ScopeAssignment['targetType'],
    targetId: string
  ): Promise<ScopeAssignment[]>;
  getAssignmentsForResource(tenantId: string, resourceName: string): Promise<ScopeAssignment[]>;
}

/**
 * Data scope plugin options
 */
export interface DataScopeOptions {
  /** Custom store implementation */
  store?: DataScopeStore;
  /** Default scope for resources without explicit assignment */
  defaultScope?: ScopeType;
  /** Field name for owner/creator */
  ownerField?: string;
  /** Field name for department */
  departmentField?: string;
  /** Field name for team */
  teamField?: string;
  /** Enable scope caching */
  cacheEnabled?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Context field path for common patterns
 */
export const CONTEXT_FIELDS = {
  SUBJECT_ID: 'subject.id',
  TENANT_ID: 'tenant.id',
  DEPARTMENT_ID: 'subject.metadata.departmentId',
  TEAM_ID: 'subject.metadata.teamId',
  ROLE: 'subject.roles',
} as const;

/**
 * Common resource fields
 */
export const RESOURCE_FIELDS = {
  OWNER: 'createdBy',
  TENANT: 'tenantId',
  DEPARTMENT: 'departmentId',
  TEAM: 'teamId',
} as const;
