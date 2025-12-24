import type { DataScopeDefinition } from '../types.js';
import { scope } from './builder.js';

/**
 * Predefined scope: All access (no restrictions)
 */
export const SCOPE_ALL: DataScopeDefinition = scope('All Access')
  .id('scope:all')
  .description('No data restrictions - access all records')
  .all()
  .priority(1000)
  .exclusive()
  .build();

/**
 * Predefined scope: Tenant isolation
 */
export const SCOPE_TENANT: DataScopeDefinition = scope('Tenant')
  .id('scope:tenant')
  .description('Access records within the same tenant')
  .tenant()
  .priority(100)
  .build();

/**
 * Predefined scope: Own records only
 */
export const SCOPE_SELF: DataScopeDefinition = scope('Self')
  .id('scope:self')
  .description('Access only own records')
  .self('createdBy')
  .priority(10)
  .build();

/**
 * Predefined scope: Department
 */
export const SCOPE_DEPARTMENT: DataScopeDefinition = scope('Department')
  .id('scope:department')
  .description('Access records in the same department')
  .department()
  .priority(50)
  .build();

/**
 * Predefined scope: Team
 */
export const SCOPE_TEAM: DataScopeDefinition = scope('Team')
  .id('scope:team')
  .description('Access records in the same team')
  .team()
  .priority(30)
  .build();

/**
 * All predefined scopes
 */
export const PREDEFINED_SCOPES = {
  all: SCOPE_ALL,
  tenant: SCOPE_TENANT,
  self: SCOPE_SELF,
  department: SCOPE_DEPARTMENT,
  team: SCOPE_TEAM,
} as const;

/**
 * Get predefined scope by type
 */
export function getPredefinedScope(type: keyof typeof PREDEFINED_SCOPES): DataScopeDefinition {
  return PREDEFINED_SCOPES[type];
}
