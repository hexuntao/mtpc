import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  ApiFetcherOptions,
  DefaultApiResponse,
  PermissionContextValue,
  PermissionProviderProps,
} from './types.js';
import { evaluatePermissions } from './utils.js';

/**
 * Permission context
 */
const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Default context (used before provider is mounted)
 */
const defaultContext: PermissionContextValue = {
  tenantId: undefined,
  subjectId: undefined,
  roles: [],
  permissions: [],
  loading: false,
  error: undefined,
  lastUpdated: undefined,

  can: () => false,
  canAny: () => false,
  canAll: () => false,
  evaluate: required => ({
    required,
    granted: [],
    missing: required,
    allowed: false,
  }),
  refresh: async () => {
    // no-op
  },
};

/**
 * PermissionProvider - React context provider for MTPC permissions
 */
export function PermissionProvider(props: PermissionProviderProps): JSX.Element {
  const {
    children,
    initialPermissions = [],
    initialRoles = [],
    tenantId,
    subjectId,
    fetcher,
    autoFetch = true,
  } = props;

  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [loading, setLoading] = useState<boolean>(!!(fetcher && autoFetch));
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!fetcher) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await fetcher();
      setPermissions(result.permissions ?? []);
      setRoles(result.roles ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (fetcher && autoFetch) {
      void refresh();
    }
  }, [fetcher, autoFetch, refresh]);

  const can = useCallback(
    (permission: string): boolean => evaluatePermissions(permissions, [permission], 'all').allowed,
    [permissions]
  );

  const canAny = useCallback(
    (perms: string[]): boolean => evaluatePermissions(permissions, perms, 'any').allowed,
    [permissions]
  );

  const canAll = useCallback(
    (perms: string[]): boolean => evaluatePermissions(permissions, perms, 'all').allowed,
    [permissions]
  );

  const evaluate = useCallback(
    (perms: string[], mode = 'all' as const) => evaluatePermissions(permissions, perms, mode),
    [permissions]
  );

  const value: PermissionContextValue = useMemo(
    () => ({
      tenantId,
      subjectId,
      roles,
      permissions,
      loading,
      error,
      lastUpdated,
      can,
      canAny,
      canAll,
      evaluate,
      refresh,
    }),
    [
      tenantId,
      subjectId,
      roles,
      permissions,
      loading,
      error,
      lastUpdated,
      can,
      canAny,
      canAll,
      evaluate,
      refresh,
    ]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * Hook to access PermissionContext
 */
export function usePermissionContext(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  return ctx ?? defaultContext;
}

/**
 * Build a simple fetcher from generic API config
 */
export function createApiPermissionFetcher(
  options: ApiFetcherOptions
): () => Promise<{ permissions: string[]; roles?: string[] }> {
  const { baseUrl, path = '/permissions', headers = {}, extractor } = options;

  return async () => {
    const res = await fetch(baseUrl + path, {
      method: 'GET',
      headers,
    });

    const json = (await res.json()) as unknown;

    if (extractor) {
      return extractor(json);
    }

    // Default extractor expects DefaultApiResponse shape
    const data = json as DefaultApiResponse;
    if (!data.success) {
      throw new Error(data.error?.message ?? 'Failed to load permissions');
    }

    return {
      permissions: data.data?.permissions ?? [],
      roles: data.data?.roles ?? [],
    };
  };
}
