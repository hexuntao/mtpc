import { computed, inject, provide, type Ref, ref } from 'vue';
import type {
  ApiFetcherOptions,
  PermissionContextValue,
  PermissionProviderProps,
} from './types.js';
import { evalPermissions } from './utils.js';

/**
 * Injection key
 */
const PermissionSymbol = Symbol('MTPCPermissionContext');

/**
 * Create permission context value
 */
export function createPermissionContext(props: PermissionProviderProps): PermissionContextValue {
  const permissions = ref<string[]>(props.initialPermissions ?? []);
  const roles = ref<string[]>(props.initialRoles ?? []);
  const loading = ref<boolean>(!!(props.fetcher && props.autoFetch !== false));
  const error = ref<string | undefined>(undefined);
  const lastUpdated = ref<Date | undefined>(undefined);

  const refresh = async () => {
    if (!props.fetcher) return;
    loading.value = true;
    error.value = undefined;
    try {
      const result = await props.fetcher();
      permissions.value = result.permissions ?? [];
      roles.value = result.roles ?? [];
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch permissions';
    } finally {
      loading.value = false;
    }
  };

  if (props.fetcher && props.autoFetch !== false) {
    void refresh();
  }

  const can = (perm: string): boolean => evalPermissions(permissions.value, [perm], 'all').allowed;

  const canAny = (perms: string[]): boolean =>
    evalPermissions(permissions.value, perms, 'any').allowed;

  const canAll = (perms: string[]): boolean =>
    evalPermissions(permissions.value, perms, 'all').allowed;

  const evaluate = (perms: string[], mode = 'all' as const) =>
    evalPermissions(permissions.value, perms, mode);

  return {
    tenantId: props.tenantId,
    subjectId: props.subjectId,
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
  };
}

/**
 * Provide context
 */
export function providePermissionContext(ctx: PermissionContextValue): void {
  provide(PermissionSymbol, ctx);
}

/**
 * Inject context
 */
export function usePermissionContext(): PermissionContextValue {
  const ctx = inject<PermissionContextValue | null>(PermissionSymbol, null);
  if (!ctx) {
    // default context
    const dummy = createPermissionContext({});
    return dummy;
  }
  return ctx;
}

/**
 * Create simple API fetcher
 */
export function createApiPermissionFetcher(
  options: ApiFetcherOptions
): () => Promise<{ permissions: string[]; roles?: string[] }> {
  const { baseUrl, path = '/permissions', headers = {} } = options;
  return async () => {
    const res = await fetch(baseUrl + path, {
      method: 'GET',
      headers,
    });
    const json = await res.json();
    // 尽量兼容 example-api 的返回结构
    const data = json?.data ?? {};
    return {
      permissions: data.permissions ?? [],
      roles: data.roles ?? [],
    };
  };
}
