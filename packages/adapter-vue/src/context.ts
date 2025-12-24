// @mtpc/adapter-vue - MTPC 的 Vue 3 适配器

import { inject, provide, ref } from 'vue';
import type {
  ApiFetcherOptions,
  PermissionContextValue,
  PermissionProviderProps,
} from './types.js';
import { evalPermissions } from './utils.js';

/**
 * 权限上下文注入符号
 * 用于在 Vue 组件树中提供和注入权限上下文
 */
const PermissionSymbol = Symbol('MTPCPermissionContext');

/**
 * 创建权限上下文值
 * @param props 权限提供者配置参数
 * @returns 权限上下文值
 */
export function createPermissionContext(props: PermissionProviderProps): PermissionContextValue {
  // 权限状态管理
  const permissions = ref<string[]>(props.initialPermissions ?? []);
  const roles = ref<string[]>(props.initialRoles ?? []);
  const loading = ref<boolean>(!!(props.fetcher && props.autoFetch !== false));
  const error = ref<string | undefined>(undefined);
  const lastUpdated = ref<Date | undefined>(undefined);

  /**
   * 刷新权限方法
   * 从远程获取最新的权限和角色信息
   */
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
      error.value = e instanceof Error ? e.message : '加载权限失败';
    } finally {
      loading.value = false;
    }
  };

  // 如果配置了 fetcher 且 autoFetch 不为 false，则自动加载权限
  if (props.fetcher && props.autoFetch !== false) {
    refresh();
  }

  /**
   * 检查单个权限是否允许
   * @param perm 权限代码，如 'user:read'
   * @returns 是否允许该权限
   */
  const can = (perm: string): boolean => evalPermissions(permissions.value, [perm], 'all').allowed;

  /**
   * 检查是否允许任意一个权限
   * @param perms 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许任意一个权限
   */
  const canAny = (perms: string[]): boolean =>
    evalPermissions(permissions.value, perms, 'any').allowed;

  /**
   * 检查是否允许所有权限
   * @param perms 权限代码数组，如 ['user:read', 'user:write']
   * @returns 是否允许所有权限
   */
  const canAll = (perms: string[]): boolean =>
    evalPermissions(permissions.value, perms, 'all').allowed;

  /**
   * 评估权限，返回详细的权限检查结果
   * @param perms 权限代码数组
   * @param mode 匹配模式：'any'（任意一个）或 'all'（所有）
   * @returns 权限评估结果
   */
  const evaluate = (perms: string[], mode = 'all' as const) =>
    evalPermissions(permissions.value, perms, mode);

  // 返回完整的权限上下文值
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
 * 提供权限上下文
 * 用于在 Vue 组件树中向下传递权限上下文
 * @param ctx 权限上下文值
 */
export function providePermissionContext(ctx: PermissionContextValue): void {
  provide(PermissionSymbol, ctx);
}

/**
 * 注入权限上下文
 * 用于在 Vue 组件中获取权限上下文
 * @returns 权限上下文值
 */
export function usePermissionContext(): PermissionContextValue {
  // 尝试从父组件注入权限上下文
  const ctx = inject<PermissionContextValue | null>(PermissionSymbol, null);

  if (!ctx) {
    // 如果没有找到上下文，则创建一个默认的空上下文
    const dummy = createPermissionContext({});
    return dummy;
  }

  return ctx;
}

/**
 * 创建简单的 API 权限获取器
 * 用于从远程 API 获取权限数据
 * @param options API 获取器配置
 * @returns 权限获取器函数
 */
export function createApiPermissionFetcher(
  options: ApiFetcherOptions
): () => Promise<{ permissions: string[]; roles?: string[] }> {
  const { baseUrl, path = '/permissions', headers = {} } = options;

  return async () => {
    // 发送 GET 请求获取权限
    const res = await fetch(baseUrl + path, {
      method: 'GET',
      headers,
    });

    const json = (await res.json()) as any;
    // 尽量兼容 example-api 的返回结构
    const data = json?.data ?? {};

    return {
      permissions: data.permissions ?? [],
      roles: data.roles ?? [],
    };
  };
}
