import type { MTPCContext, SubjectContext, TenantContext } from '@mtpc/core';
import type { ReactNode } from 'react';

/**
 * Permission matching mode
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
 * Permission context value
 */
export interface PermissionContextValue {
  tenantId?: string;
  subjectId?: string;
  roles: string[];
  permissions: string[];
  loading: boolean;
  error?: string;
  lastUpdated?: Date;

  /**
   * Check if a single permission is allowed
   */
  can(permission: string): boolean;

  /**
   * Check if any of the permissions is allowed
   */
  canAny(permissions: string[]): boolean;

  /**
   * Check if all permissions are allowed
   */
  canAll(permissions: string[]): boolean;

  /**
   * Explain which permissions are granted/missing
   */
  evaluate(permissions: string[], mode?: MatchMode): PermissionEvalResult;

  /**
   * Refresh permissions from remote (if fetcher configured)
   */
  refresh(): Promise<void>;
}

/**
 * Provider props
 */
export interface PermissionProviderProps {
  children: ReactNode;

  /**
   * Initial permissions (e.g. from SSR or preloaded state)
   */
  initialPermissions?: string[];

  /**
   * Initial roles
   */
  initialRoles?: string[];

  /**
   * Tenant and subject identity (optional, for display only)
   */
  tenantId?: string;
  subjectId?: string;

  /**
   * Remote fetcher for permissions
   * Should return { permissions, roles? }
   */
  fetcher?: () => Promise<{
    permissions: string[];
    roles?: string[];
  }>;

  /**
   * Auto fetch on mount when fetcher is provided (default: true)
   */
  autoFetch?: boolean;
}

/**
 * Hook options
 */
export interface UsePermissionOptions {
  /** Whether to throw error if not allowed (default: false) */
  throwOnDenied?: boolean;
}

/**
 * Props for <Can> component
 */
export interface CanProps {
  permission?: string;
  permissions?: string[];
  mode?: MatchMode;
  not?: boolean;
  fallback?: ReactNode;
  children?: ReactNode | ((allowed: boolean) => ReactNode);
}

/**
 * Props for <Cannot> component
 */
export interface CannotProps extends Omit<CanProps, 'not'> {}

/**
 * Props for <PermissionGuard> component
 */
export interface PermissionGuardProps extends CanProps {}

/**
 * API-based fetcher options
 * This is intentionally generic, not tied to any specific backend.
 */
export interface ApiFetcherOptions {
  /**
   * Base URL for the API, e.g. "/api"
   */
  baseUrl: string;

  /**
   * Endpoint path for permissions, e.g. "/permissions"
   */
  path?: string;

  /**
   * Optional headers to include in the request
   */
  headers?: Record<string, string>;

  /**
   * Extractor function to parse response into { permissions, roles }
   */
  extractor?: (response: unknown) => {
    permissions: string[];
    roles?: string[];
  };
}

/**
 * API response shape used by the default extractor
 */
export interface DefaultApiResponse {
  success: boolean;
  data?: {
    permissions?: string[];
    roles?: string[];
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}
