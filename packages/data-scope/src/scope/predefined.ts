import type { DataScopeDefinition } from '../types.js';
import { scope } from './builder.js';

/**
 * 预定义范围：完全访问（无限制）
 */
export const SCOPE_ALL: DataScopeDefinition = scope('All Access')
  .id('scope:all')
  .description('No data restrictions - access all records')
  .all()
  .priority(1000)
  .exclusive()
  .build();

/**
 * 预定义范围：租户隔离
 */
export const SCOPE_TENANT: DataScopeDefinition = scope('Tenant')
  .id('scope:tenant')
  .description('Access records within the same tenant')
  .tenant()
  .priority(100)
  .build();

/**
 * 预定义范围：仅自己的记录
 */
export const SCOPE_SELF: DataScopeDefinition = scope('Self')
  .id('scope:self')
  .description('Access only own records')
  .self('createdBy')
  .priority(10)
  .build();

/**
 * 预定义范围：部门
 */
export const SCOPE_DEPARTMENT: DataScopeDefinition = scope('Department')
  .id('scope:department')
  .description('Access records in the same department')
  .department()
  .priority(50)
  .build();

/**
 * 预定义范围：团队
 */
export const SCOPE_TEAM: DataScopeDefinition = scope('Team')
  .id('scope:team')
  .description('Access records in the same team')
  .team()
  .priority(30)
  .build();

/**
 * 所有预定义范围
 */
export const PREDEFINED_SCOPES = {
  all: SCOPE_ALL,
  tenant: SCOPE_TENANT,
  self: SCOPE_SELF,
  department: SCOPE_DEPARTMENT,
  team: SCOPE_TEAM,
} as const;

/**
 * 根据类型获取预定义范围
 */
export function getPredefinedScope(type: keyof typeof PREDEFINED_SCOPES): DataScopeDefinition {
  return PREDEFINED_SCOPES[type];
}
