import type { Ref } from 'vue';

/**
 * Matching mode for permissions
 */
export type MatchMode = 'any' | 'all';

/**
 * Permission evaluation result
 */
export interface PermissionEvalResult {
  required: string[];
  granted: string[];
  missing: string[];
  allowed: boolean;
}

/**
 * Context value for permissions
 */
export interface PermissionContextValue {
  tenantId?: string;
  subjectId?: string;
  roles: Ref<string[]>;
  permissions: Ref<string[]>;
  loading: Ref<boolean>;
  error: Ref<string | undefined>;
  lastUpdated: Ref<Date | undefined>;

  can(permission: string): boolean;
  canAny(permissions: string[]): boolean;
  canAll(permissions: string[]): boolean;
  evaluate(permissions: string[], mode?: MatchMode): PermissionEvalResult;
  refresh(): Promise<void>;
}

/**
 * Provider props
 */
export interface PermissionProviderProps {
  initialPermissions?: string[];
  initialRoles?: string[];
  tenantId?: string;
  subjectId?: string;
  fetcher?: () => Promise<{ permissions: string[]; roles?: string[] }>;
  autoFetch?: boolean;
}

/**
 * Props for components
 */
export interface CanProps {
  permission?: string;
  permissions?: string[];
  mode?: MatchMode;
  not?: boolean;
}

/**
 * API fetcher options
 */
export interface ApiFetcherOptions {
  baseUrl: string;
  path?: string;
  headers?: Record<string, string>;
}
